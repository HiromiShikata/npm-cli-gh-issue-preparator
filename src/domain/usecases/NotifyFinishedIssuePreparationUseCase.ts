import { CopilotRepository } from './adapter-interfaces/CopilotRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

export class IssueNotFoundError extends Error {
  constructor(issueUrl: string) {
    super(`Issue not found: ${issueUrl}`);
    this.name = 'IssueNotFoundError';
  }
}
export class IllegalIssueStatusError extends Error {
  constructor(issueUrl: string, currentStatus: string, expectedStatus: string) {
    super(
      `Illegal issue status for ${issueUrl}: expected ${expectedStatus}, but got ${currentStatus}`,
    );
    this.name = 'IllegalIssueStatusError';
  }
}

export class NotifyFinishedIssuePreparationUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly issueRepository: IssueRepository,
    private readonly copilotRepository: CopilotRepository,
  ) {}

  run = async (params: {
    projectUrl: string;
    issueUrl: string;
    preparationStatus: string;
    awaitingAutoQualityCheckStatus: string;
    awaitingQualityCheckStatus: string;
    commentCountThreshold: number;
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

    issue.status = params.awaitingAutoQualityCheckStatus;
    await this.issueRepository.update(issue, project);

    const prompt = this.buildCopilotPrompt(params, project);
    this.copilotRepository.run(prompt, 'gpt-5-mini', issue.title);
  };

  private buildCopilotPrompt = (
    params: {
      issueUrl: string;
      preparationStatus: string;
      awaitingAutoQualityCheckStatus: string;
      awaitingQualityCheckStatus: string;
      commentCountThreshold: number;
    },
    project: { id: string; statusFieldId: string | null },
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
8. If all jobs are finished and all CI passed, and not all PR review comments are resolved, comment to issue "REVIEW_COMMENTS_NOT_RESOLVED" and change status to ${params.preparationStatus}

## Information
- Project ID: ${project.id}
- StatusFieldId: ${project.statusFieldId}
`;
  };
}
