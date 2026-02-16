import { CopilotRepository } from './adapter-interfaces/CopilotRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';

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
  | 'NO_REPORT'
  | 'PULL_REQUEST_NOT_FOUND'
  | 'MULTIPLE_PULL_REQUESTS_FOUND'
  | 'PULL_REQUEST_CONFLICTED'
  | 'ANY_CI_JOB_FAILED'
  | 'ANY_REVIEW_COMMENT_NOT_RESOLVED';

export class NotifyFinishedIssuePreparationUseCase {
  constructor(
    private readonly projectRepository: Pick<ProjectRepository, 'getByUrl'>,
    private readonly issueRepository: Pick<
      IssueRepository,
      'get' | 'update' | 'findRelatedOpenPRs'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
    private readonly copilotRepository: CopilotRepository,
  ) {}

  run = async (params: {
    projectUrl: string;
    issueUrl: string;
    preparationStatus: string;
    awaitingAutoQualityCheckStatus: string;
    awaitingWorkspaceStatus: string;
    awaitingQualityCheckStatus: string;
    commentCountThreshold: number;
    thresholdForAutoReject: number;
  }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);

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
      ).length >= params.thresholdForAutoReject
    ) {
      issue.status = params.awaitingQualityCheckStatus;
      await this.issueRepository.update(issue, project);
      await this.issueCommentRepository.createComment(
        issue,
        `Failed to pass the check autimatically for ${params.thresholdForAutoReject} times`,
      );
      return;
    }

    const rejectedReasons: RejectedReasonType[] = [];
    const lastComment = comments[comments.length - 1];
    if (!lastComment || lastComment.content.startsWith('Auto Status Check: ')) {
      rejectedReasons.push('NO_REPORT');
    }

    const hasCategoryLabel = issue.labels.some((label) =>
      label.startsWith('category:'),
    );
    if (!hasCategoryLabel) {
      const relatedOpenPrs = await this.issueRepository.findRelatedOpenPRs(
        issue.url,
      );
      if (relatedOpenPrs.length <= 0) {
        rejectedReasons.push('PULL_REQUEST_NOT_FOUND');
      } else if (relatedOpenPrs.length > 1) {
        rejectedReasons.push('MULTIPLE_PULL_REQUESTS_FOUND');
      } else {
        const pr = relatedOpenPrs[0];
        if (pr.isConflicted) {
          rejectedReasons.push('PULL_REQUEST_CONFLICTED');
        }
        if (!pr.isPassedAllCiJob) {
          rejectedReasons.push('ANY_CI_JOB_FAILED');
        }
        if (!pr.isResolvedAllReviewComments) {
          rejectedReasons.push('ANY_REVIEW_COMMENT_NOT_RESOLVED');
        }
      }
    }

    if (rejectedReasons.length <= 0) {
      issue.status = params.awaitingAutoQualityCheckStatus;
      await this.issueRepository.update(issue, project);

      const prompt = this.buildCopilotPrompt(params, project);
      this.copilotRepository.run(prompt, 'gpt-5-mini', issue.title);
      return;
    }

    issue.status = params.awaitingWorkspaceStatus;
    await this.issueRepository.update(issue, project);

    await this.issueCommentRepository.createComment(
      issue,
      `
Auto Status Check: REJECTED
${JSON.stringify(rejectedReasons)}`,
    );
  };

  private buildCopilotPrompt = (
    params: {
      issueUrl: string;
      preparationStatus: string;
      awaitingAutoQualityCheckStatus: string;
      awaitingQualityCheckStatus: string;
      commentCountThreshold: number;
    },
    project: { id: string; status: { fieldId: string } },
  ): string => {
    return `Please check the issue and PR status and update status of the issue.
Target issue: ${params.issueUrl}

## Step
1. Find PR related to the issue
2. Check local status and update local to use branch of PR
3. Check if branch of PR is up to date with latest default branch, and if the branch is not up to date, update by rebase
4. Check all CI checks are finished
5. Get all issue comments (GitHub issue comments on the issue, not PR review comments) and if there are ${params.commentCountThreshold} or more comments posted, comment to issue "NEEDS_HUMAN_REVIEW_DUE_TO_COMMENT_VOLUME" and change status to ${params.awaitingQualityCheckStatus} to check by human (skip steps 6-8)
6. If all jobs are finished and all CI jobs passed and all PR review comments are resolved, comment to issue "ALL_CI_PASSED_AND_REVIEW_COMMENTS_RESOLVED" and change status to ${params.awaitingQualityCheckStatus}
7. If all jobs are finished and one or more CI jobs failed, comment to issue "CI_NOT_PASSED" and change status to ${params.preparationStatus}
8. If all jobs are finished and one or more PR review comments are not resolved, comment to issue "REVIEW_COMMENTS_NOT_RESOLVED" and change status to ${params.preparationStatus}

## Information
- Project ID: ${project.id}
- StatusFieldId: ${project.status.fieldId}`;
  };
}
