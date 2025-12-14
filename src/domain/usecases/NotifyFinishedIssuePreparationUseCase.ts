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
  ) {}

  run = async (params: {
    projectUrl: string;
    issueUrl: string;
    preparationStatus: string;
    awaitingQualityCheckStatus: string;
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

    issue.status = params.awaitingQualityCheckStatus;
    await this.issueRepository.update(issue, project);
  };
}
