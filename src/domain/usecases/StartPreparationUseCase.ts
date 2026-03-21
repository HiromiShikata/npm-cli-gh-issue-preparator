import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';

export class StartPreparationUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly issueRepository: IssueRepository,
    private readonly localCommandRunner: LocalCommandRunner,
  ) {}

  private parseMaximumPreparingIssuesCountFromReadme = (
    readme: string | null,
  ): number | null => {
    if (!readme) return null;
    const match = readme.match(/maximumPreparingIssuesCount:\s*(\d+)/);
    if (!match) return null;
    return parseInt(match[1], 10);
  };

  run = async (params: {
    projectUrl: string;
    awaitingWorkspaceStatus: string;
    preparationStatus: string;
    defaultAgentName: string;
    logFilePath?: string;
    maximumPreparingIssuesCount: number | null;
  }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    const maximumPreparingIssuesCount =
      params.maximumPreparingIssuesCount ??
      this.parseMaximumPreparingIssuesCountFromReadme(project.readme) ??
      6;

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
