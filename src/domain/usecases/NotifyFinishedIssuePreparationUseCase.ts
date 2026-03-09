import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { StoryObjectMap } from '../entities/StoryObjectMap';

export class IssueNotFoundError extends Error {
  constructor(issueUrl: string) {
    super(`Issue not found: ${issueUrl}`);
    this.name = 'IssueNotFoundError';
  }
}
export class IllegalIssueStatusError extends Error {
  constructor(
    issueUrl: string,
    currentStatus: string | null,
    expectedStatus: string | null,
  ) {
    super(
      `Illegal issue status for ${issueUrl}: expected ${expectedStatus}, but got ${currentStatus}`,
    );
    this.name = 'IllegalIssueStatusError';
  }
}
type RejectedReasonType =
  | 'NO_REPORT_FROM_AGENT_BOT'
  | 'PULL_REQUEST_NOT_FOUND'
  | 'MULTIPLE_PULL_REQUESTS_FOUND'
  | 'PULL_REQUEST_CONFLICTED'
  | 'ANY_CI_JOB_FAILED_OR_IN_PROGRESS'
  | 'REQUIRED_CI_JOB_NEVER_STARTED'
  | 'ANY_REVIEW_COMMENT_NOT_RESOLVED';

export class NotifyFinishedIssuePreparationUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'prepareStatus'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'get' | 'update' | 'findRelatedOpenPRs' | 'getStoryObjectMap'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
  ) {}

  run = async (params: {
    projectUrl: string;
    issueUrl: string;
    preparationStatus: string;
    awaitingWorkspaceStatus: string;
    awaitingQualityCheckStatus: string;
    thresholdForAutoReject: number;
  }): Promise<void> => {
    let project = await this.projectRepository.getByUrl(params.projectUrl);
    project = await this.projectRepository.prepareStatus(
      params.preparationStatus,
      project,
    );
    project = await this.projectRepository.prepareStatus(
      params.awaitingWorkspaceStatus,
      project,
    );
    project = await this.projectRepository.prepareStatus(
      params.awaitingQualityCheckStatus,
      project,
    );

    const issue = await this.issueRepository.get(params.issueUrl, project);

    if (!issue) {
      throw new IssueNotFoundError(params.issueUrl);
    } else if (issue.status !== params.preparationStatus) {
      throw new IllegalIssueStatusError(
        params.issueUrl,
        issue.status,
        params.preparationStatus,
      );
    }
    const comments =
      await this.issueCommentRepository.getCommentsFromIssue(issue);

    const lastTargetComments = comments.slice(
      -params.thresholdForAutoReject * 2,
    );
    if (
      lastTargetComments.filter((comment) =>
        comment.content.startsWith('Auto Status Check: REJECTED'),
      ).length >= params.thresholdForAutoReject &&
      !lastTargetComments.some((comment) =>
        comment.content.toLowerCase().startsWith('retry'),
      )
    ) {
      issue.status = params.awaitingQualityCheckStatus;
      await this.issueRepository.update(issue, project);
      await this.issueCommentRepository.createComment(
        issue,
        `Failed to pass the check autimatically for ${params.thresholdForAutoReject} times`,
      );
      return;
    }

    const rejections: { type: RejectedReasonType; detail: string }[] = [];
    const lastComment = comments[comments.length - 1];
    if (!lastComment || !lastComment.content.startsWith('From:')) {
      rejections.push({
        type: 'NO_REPORT_FROM_AGENT_BOT',
        detail: 'NO_REPORT_FROM_AGENT_BOT',
      });
    }

    const categoryLabels = issue.labels.filter((label) =>
      label.startsWith('category:'),
    );
    if (categoryLabels.length <= 0 || categoryLabels.includes('category:e2e')) {
      const relatedOpenPrs = await this.issueRepository.findRelatedOpenPRs(
        issue.url,
      );
      if (relatedOpenPrs.length <= 0) {
        rejections.push({
          type: 'PULL_REQUEST_NOT_FOUND',
          detail: 'PULL_REQUEST_NOT_FOUND',
        });
      } else if (relatedOpenPrs.length > 1) {
        rejections.push({
          type: 'MULTIPLE_PULL_REQUESTS_FOUND',
          detail: `MULTIPLE_PULL_REQUESTS_FOUND: ${relatedOpenPrs.map((pr) => pr.url).join(', ')}`,
        });
      } else {
        const pr = relatedOpenPrs[0];
        if (pr.isConflicted) {
          rejections.push({
            type: 'PULL_REQUEST_CONFLICTED',
            detail: `PULL_REQUEST_CONFLICTED: ${pr.url}`,
          });
        }
        if (!pr.isPassedAllCiJob) {
          const missingChecks = pr.missingRequiredCheckNames;
          const missingSuffix =
            missingChecks.length > 0
              ? ` (missing: ${missingChecks.join(', ')})`
              : '';
          if (pr.isCiStateSuccess && missingChecks.length > 0) {
            rejections.push({
              type: 'REQUIRED_CI_JOB_NEVER_STARTED',
              detail: `REQUIRED_CI_JOB_NEVER_STARTED: ${pr.url}${missingSuffix}`,
            });
          } else {
            rejections.push({
              type: 'ANY_CI_JOB_FAILED_OR_IN_PROGRESS',
              detail: `ANY_CI_JOB_FAILED_OR_IN_PROGRESS: ${pr.url}${missingSuffix}`,
            });
          }
        }
        if (!pr.isResolvedAllReviewComments) {
          rejections.push({
            type: 'ANY_REVIEW_COMMENT_NOT_RESOLVED',
            detail: `ANY_REVIEW_COMMENT_NOT_RESOLVED: ${pr.url}`,
          });
        }
      }
    }

    if (rejections.length <= 0) {
      issue.status = params.awaitingQualityCheckStatus;
      await this.issueRepository.update(issue, project);
      return;
    }

    issue.status = params.awaitingWorkspaceStatus;
    await this.issueRepository.update(issue, project);

    await this.issueCommentRepository.createComment(
      issue,
      `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`,
    );

    const storyObjectMap =
      await this.issueRepository.getStoryObjectMap(project);
    const workflowBlockerRepos =
      this.extractWorkflowBlockerRepos(storyObjectMap);
    const issueOrgRepo = `${issue.org}/${issue.repo}`;
    if (workflowBlockerRepos.some((repo) => repo === issueOrgRepo)) {
      await this.issueCommentRepository.createComment(
        issue,
        'retry after resolved workflow blocker issue',
      );
    }
  };

  private extractWorkflowBlockerRepos = (
    storyObjectMap: StoryObjectMap,
  ): string[] => {
    const workflowBlockerStoryNames = Array.from(storyObjectMap.keys()).filter(
      (storyName) => storyName.toLowerCase().includes('workflow blocker'),
    );
    if (workflowBlockerStoryNames.length === 0) {
      return [];
    }

    const orgRepos = new Set<string>();
    workflowBlockerStoryNames.forEach((storyName) => {
      const issues =
        storyObjectMap
          .get(storyName)
          ?.issues.filter((issue) => issue.state === 'OPEN') || [];
      issues.forEach((issue) => {
        const orgRepo = issue.url.split('/issues')[0].split('github.com/')[1];
        orgRepos.add(orgRepo);
      });
    });
    return Array.from(orgRepos);
  };
}
