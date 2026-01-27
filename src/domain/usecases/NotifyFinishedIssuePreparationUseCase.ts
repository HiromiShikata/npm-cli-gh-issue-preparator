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
      awaitingQualityCheckStatus: string;
      commentCountThreshold: number;
    },
    project: { id: string; statusFieldId: string | null },
  ): string => {
    return `Please check the issue and PR status and update status of the issue.
Target issue: ${params.issueUrl}

## Step
1. find PR related the issue
1. check local status and update local to use branch of PR
1. Check branch of PR is latest on latest default branch and if the branch is not latest, update by rebase
1. Check all CI check is finished and if finished all.
1. If all job is finished and all ci job passed, all comment is resolved, comment to issue "ALL_CI_PASSED, ALL_REVIEW_COMMENT_RESOLVED" and change status to ${params.awaitingQualityCheckStatus}
1. Get all comment of the issue and there is ${params.commentCountThreshold} or more comments posted, change status to ${params.awaitingQualityCheckStatus} to check by human
1. If all job is finished and all ci one or more job failed, comment to issue "CI_NOT_PASSED" and change status to ${params.preparationStatus}
1. If all job is finished and all ci passed, and not resolved all review comment, comment to issue "REVIEW_COMMENT_NOT_RESOLVED" and change status to ${params.preparationStatus}
1. If all job is not finished, wait 5min, and update by rebase, and check ci status

## Project information to call api
- Project ID: ${project.id}
- StatusFieldId: ${project.statusFieldId || ''}
`;
  };
}
