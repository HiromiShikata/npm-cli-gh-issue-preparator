import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
export declare class StartPreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly localCommandRunner;
    maximumPreparingIssuesCount: number;
    constructor(projectRepository: ProjectRepository, issueRepository: IssueRepository, localCommandRunner: LocalCommandRunner);
    run: (params: {
        projectUrl: string;
        awaitingWorkspaceStatus: string;
        preparationStatus: string;
        defaultAgentName: string;
        logFilePath?: string;
    }) => Promise<void>;
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map