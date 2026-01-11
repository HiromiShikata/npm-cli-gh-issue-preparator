import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';

export class StartPreparationUseCase {
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
    maximumPreparingIssuesCount?: number;
  }): Promise<void> => {
    const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;
    const project = await this.projectRepository.getByUrl(params.projectUrl);

    const allIssues = await this.issueRepository.getAllOpened(project);

    const awaitingWorkspaceIssues = allIssues.filter(
      (issue) => issue.status === params.awaitingWorkspaceStatus,
    );
    const currentPreparationIssueCount = allIssues.filter(
      (issue) => issue.status === params.preparationStatus,
    ).length;

    const targetCount = Math.min(
      maximumPreparingIssuesCount,
      awaitingWorkspaceIssues.length + currentPreparationIssueCount,
    );

    for (const issue of awaitingWorkspaceIssues.slice(
      0,
      targetCount - currentPreparationIssueCount,
    )) {
      const agent =
        issue.labels
          .find((label) => label.startsWith('category:'))
          ?.replace('category:', '')
          .trim() || params.defaultAgentName;
      issue.status = params.preparationStatus;
      await this.issueRepository.update(issue, project);

      await this.localCommandRunner.runCommand(
        `aw ${issue.url} ${agent} ${project.url}`,
      );
    }
  };
}
