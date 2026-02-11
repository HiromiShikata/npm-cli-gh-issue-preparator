import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';

export class StartPreparationUseCase {
  constructor(
    private readonly projectRepository: Pick<ProjectRepository, 'getByUrl'>,
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllOpened' | 'update'
    >,
    private readonly localCommandRunner: LocalCommandRunner,
  ) {}

  run = async (params: {
    projectUrl: string;
    awaitingWorkspaceStatus: string;
    preparationStatus: string;
    defaultAgentName: string;
    logFilePath?: string;
    maximumPreparingIssuesCount: number | null;
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

    for (
      let i = currentPreparationIssueCount;
      i <
      Math.min(
        maximumPreparingIssuesCount,
        awaitingWorkspaceIssues.length + currentPreparationIssueCount,
      );
      i++
    ) {
      const issue = awaitingWorkspaceIssues.pop();
      if (!issue) {
        break;
      }
      const agent =
        issue.labels
          .find((label) => label.startsWith('category:'))
          ?.replace('category:', '')
          .trim() || params.defaultAgentName;
      issue.status = params.preparationStatus;
      await this.issueRepository.update(issue, project);

      const logFilePathArg = params.logFilePath
        ? `--logFilePath ${params.logFilePath}`
        : '';
      await this.localCommandRunner.runCommand(
        `aw ${issue.url} ${agent} ${project.url}${logFilePathArg ? ` ${logFilePathArg}` : ''}`,
      );
    }
  };
}
