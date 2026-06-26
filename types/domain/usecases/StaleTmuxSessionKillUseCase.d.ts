import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
export declare const DEFAULT_EXCLUDED_STATUS = 'In Tmux by human';
export declare const DEFAULT_IDLE_THRESHOLD_SECONDS: number;
export declare class StaleTmuxSessionKillUseCase {
  private readonly projectRepository;
  private readonly issueRepository;
  private readonly localCommandRunner;
  constructor(
    projectRepository: Pick<ProjectRepository, 'getByUrl'>,
    issueRepository: Pick<IssueRepository, 'getAllOpened'>,
    localCommandRunner: Pick<LocalCommandRunner, 'runCommand'>,
  );
  run: (params: {
    projectUrl: string;
    excludedStatus: string;
    idleThresholdSeconds: number;
    now: Date;
  }) => Promise<void>;
  private listLiveSessions;
  private deriveSessionName;
  private evaluateKillReason;
}
//# sourceMappingURL=StaleTmuxSessionKillUseCase.d.ts.map
