import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';
export declare class StartPreparationUseCase {
  private readonly projectRepository;
  private readonly issueRepository;
  private readonly claudeRepository;
  private readonly localCommandRunner;
  constructor(
    projectRepository: Pick<ProjectRepository, 'getByUrl' | 'prepareStatus'>,
    issueRepository: Pick<
      IssueRepository,
      | 'getAllOpened'
      | 'getStoryObjectMap'
      | 'update'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
    >,
    claudeRepository: Pick<ClaudeRepository, 'isClaudeAvailable'>,
    localCommandRunner: LocalCommandRunner,
  );
  run: (params: {
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
  }) => Promise<void>;
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map
