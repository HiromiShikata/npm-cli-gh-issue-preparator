import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { Issue } from '../entities/Issue';
import { StoryObject, StoryObjectMap } from '../entities/StoryObjectMap';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';

export class StartPreparationUseCase {
  constructor(
    private readonly projectRepository: Pick<ProjectRepository, 'getByUrl'>,
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllOpened' | 'getStoryObjectMap' | 'update'
    >,
    private readonly claudeRepository: Pick<ClaudeRepository, 'getUsage'>,
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
    try {
      const claudeUsages = await this.claudeRepository.getUsage();
      if (claudeUsages.some((usage) => usage.utilizationPercentage > 90)) {
        console.warn(
          'Claude usage limit exceeded. Skipping starting preparation.',
        );
        return;
      }
    } catch (error) {
      console.warn('Failed to check Claude usage:', error);
    }

    const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    const storyObjectMap =
      await this.issueRepository.getStoryObjectMap(project);
    const allIssues = await this.issueRepository.getAllOpened(project);

    const repositoryBlockerIssues =
      this.createWorkflowBockerIsues(storyObjectMap);

    const awaitingWorkspaceIssues: Issue[] = Array.from(storyObjectMap.values())
      .map((storyObject) => storyObject.issues)
      .flat()
      .filter((issue) => issue.status === params.awaitingWorkspaceStatus);
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
      const blockerIssueUrls: string[] =
        repositoryBlockerIssues.find((blocker) =>
          issue.url.includes(blocker.orgRepo),
        )?.blockerIssueUrls || [];
      if (
        blockerIssueUrls.length > 0 &&
        !blockerIssueUrls.includes(issue.url)
      ) {
        continue;
      }
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
      updatedCurrentPreparationIssueCount++;
    }
  };
  createWorkflowBockerIsues = (
    storyObjectMap: StoryObjectMap,
  ): {
    orgRepo: string;
    blockerIssueUrls: string[];
  }[] => {
    const workflowBlockerStory: StoryObject['story']['name'][] = Array.from(
      storyObjectMap.keys(),
    ).filter((storyName) =>
      storyName.toLowerCase().includes('workflow blocker'),
    );
    if (workflowBlockerStory.length === 0) {
      return [];
    }

    const result: {
      orgRepo: string;
      blockerIssueUrls: string[];
    }[] =
      storyObjectMap
        .get(workflowBlockerStory[0])
        ?.issues.filter((issue) => issue.state === 'OPEN')
        .map((issue) => {
          const orgRepo = issue.url.split('/issues')[0].split('github.com/')[1];
          return {
            orgRepo,
            blockerIssueUrls: [issue.url],
          };
        }) || [];
    return result;
  };
}
