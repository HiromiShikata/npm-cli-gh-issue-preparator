import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
export declare class StartPreparationUseCase {
  private readonly issueRepository;
  private readonly localCommandRunner;
  constructor(
    issueRepository: IssueRepository,
    localCommandRunner: LocalCommandRunner,
  );
  run: (params: {
    projectUrl: string;
    awaitingWorkspaceStatus: string;
    preparationStatus: string;
    defaultAgentName: string;
    logFilePath?: string;
    maximumPreparingIssuesCount: number | null;
  }) => Promise<void>;
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map
