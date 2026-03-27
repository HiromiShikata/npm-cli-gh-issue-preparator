import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';

export class StartPreparationUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'prepareStatus'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllOpened' | 'getStoryObjectMap' | 'update' | 'findRelatedOpenPRs'
    >,
    private readonly claudeRepository: Pick<ClaudeRepository, 'getUsage'>,
    private readonly localCommandRunner: LocalCommandRunner,
  ) {}

  run = async (params: {
    projectUrl: string;
    awaitingWorkspaceStatus: string;
    preparationStatus: string;
    defaultAgentName: string;
    defaultLlmModelName: string | null;
    defaultLlmAgentName: string | null;
    logFilePath: string | null;
    maximumPreparingIssuesCount: number | null;
    utilizationPercentageThreshold: number;
    allowedIssueAuthors: string[] | null;
  }): Promise<void> => {
    const claudeUsages = await this.claudeRepository.getUsage();
    const weeklyWindowHours = 168;
    const nonWeeklyUsages = claudeUsages.filter(
      (usage) => usage.hour !== weeklyWindowHours,
    );
    if (
      nonWeeklyUsages.some(
        (usage) =>
          usage.utilizationPercentage > params.utilizationPercentageThreshold,
      )
    ) {
      console.warn(
        'Claude usage limit exceeded. Skipping starting preparation.',
      );
      return;
    }

    let maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;

    const weeklyUsages = claudeUsages.filter(
      (usage) => usage.hour === weeklyWindowHours,
    );
    if (
      weeklyUsages.length > 0 &&
      params.utilizationPercentageThreshold < 100
    ) {
      const maxWeeklyUtilization = Math.max(
        ...weeklyUsages.map((usage) => usage.utilizationPercentage),
      );
      if (maxWeeklyUtilization > params.utilizationPercentageThreshold) {
        const normalizedUtilizationBeyondThreshold =
          (maxWeeklyUtilization - params.utilizationPercentageThreshold) /
          (100 - params.utilizationPercentageThreshold);
        maximumPreparingIssuesCount = Math.floor(
          maximumPreparingIssuesCount *
            Math.pow(1 - normalizedUtilizationBeyondThreshold, 2),
        );
        if (maximumPreparingIssuesCount <= 0) {
          console.warn(
            `Weekly Claude usage (${maxWeeklyUtilization}%) exceeds threshold (${params.utilizationPercentageThreshold}%). Skipping starting preparation.`,
          );
          return;
        }
        console.warn(
          `Weekly Claude usage (${maxWeeklyUtilization}%) exceeds threshold (${params.utilizationPercentageThreshold}%). Reducing maximumPreparingIssuesCount to ${maximumPreparingIssuesCount}.`,
        );
      }
    }
    let project = await this.projectRepository.getByUrl(params.projectUrl);
    project = await this.projectRepository.prepareStatus(
      params.awaitingWorkspaceStatus,
      project,
    );
    project = await this.projectRepository.prepareStatus(
      params.preparationStatus,
      project,
    );
    const storyObjectMap =
      await this.issueRepository.getStoryObjectMap(project);
    const allIssues = await this.issueRepository.getAllOpened(project);

    const awaitingWorkspaceIssues = Array.from(storyObjectMap.values())
      .map((storyObject) => storyObject.issues)
      .flat()
      .filter((issue) => issue.status === params.awaitingWorkspaceStatus)
      .map((issue) => ({
        ...issue,
        author:
          'author' in issue && typeof issue.author === 'string'
            ? issue.author
            : '',
      }));
    const currentPreparationIssueCount = allIssues.filter(
      (issue) => issue.status === params.preparationStatus,
    ).length;
    let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;

    const now = new Date();
    const currentHour = now.getHours();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const tomorrowStart = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      todayStart.getDate() + 1,
    );

    for (
      let i = 0;
      i < awaitingWorkspaceIssues.length &&
      updatedCurrentPreparationIssueCount < maximumPreparingIssuesCount;
      i++
    ) {
      const issue = awaitingWorkspaceIssues[i];
      if (issue.dependedIssueUrls.length > 0) {
        continue;
      }
      if (
        issue.nextActionDate !== null &&
        issue.nextActionDate >= tomorrowStart
      ) {
        continue;
      }
      if (issue.nextActionHour !== null && currentHour < issue.nextActionHour) {
        continue;
      }
      if (
        params.allowedIssueAuthors !== null &&
        issue.author !== '' &&
        !params.allowedIssueAuthors.includes(issue.author)
      ) {
        continue;
      }
      const agent =
        issue.labels
          .find((label: string) => label.startsWith('llm-agent:'))
          ?.replace('llm-agent:', '')
          .trim() ||
        issue.labels
          .find((label: string) => label.startsWith('category:'))
          ?.replace('category:', '')
          .trim() ||
        params.defaultLlmAgentName ||
        params.defaultAgentName;
      const model =
        issue.labels
          .find((label: string) => label.startsWith('llm-model:'))
          ?.replace('llm-model:', '')
          .trim() ||
        params.defaultLlmModelName ||
        null;
      const relatedPRs = await this.issueRepository.findRelatedOpenPRs(
        issue.url,
      );
      const existingPRBranchName =
        relatedPRs.length > 0 ? relatedPRs[0].branchName : null;

      issue.status = params.preparationStatus;
      await this.issueRepository.update(issue, project);

      const logFilePathArg = params.logFilePath
        ? `--logFilePath ${params.logFilePath}`
        : null;
      const modelArg = model !== null ? ` ${model}` : '';
      const branchArg =
        existingPRBranchName !== null
          ? ` --branch ${existingPRBranchName}`
          : '';
      const command = `aw ${issue.url} ${agent}${modelArg} ${project.url}${logFilePathArg !== null ? ` ${logFilePathArg}` : ''}${branchArg}`;
      await this.localCommandRunner.runCommand(command);
      updatedCurrentPreparationIssueCount++;
    }
  };
}
