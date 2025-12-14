import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';

export class StartPreparationUseCase {
  maximumPreparingIssuesCount = 6;
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly issueRepository: IssueRepository,
    private readonly localCommandRunner: LocalCommandRunner,
  ) {}

  run = async (params: {
    projectUrl: string;
    awaitingWorkspaceStatus: string;
    preparationStatus: string;
    defaultAgentName: string;
  }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);

    const allIssues = await this.issueRepository.getAllOpened(project);

    const awaitingWorkspaceIssues = allIssues.filter(
      (issue) => issue.status === params.awaitingWorkspaceStatus,
    );

    if (
      allIssues.filter((issue) => issue.status === params.preparationStatus)
        .length >= this.maximumPreparingIssuesCount
    ) {
      return;
    }

    for (const issue of awaitingWorkspaceIssues) {
      const agent =
        issue.labels
          .find((label) => label.startsWith('category:'))
          ?.replace('category:', '')
          .trim() || params.defaultAgentName;
      issue.status = params.preparationStatus;
      await this.issueRepository.update(issue, project);

      await this.localCommandRunner.runCommand(
        `aw ${project.url} ${issue.url} ${agent}`,
      );
    }
  };
}
