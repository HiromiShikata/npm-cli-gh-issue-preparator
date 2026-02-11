import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
export declare class StartPreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly localCommandRunner;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl'>, issueRepository: Pick<IssueRepository, 'getAllOpened' | 'update'>, localCommandRunner: LocalCommandRunner);
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