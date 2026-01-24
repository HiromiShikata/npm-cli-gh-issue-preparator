import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class IssueNotFoundError extends Error {
    constructor(issueUrl: string);
}
export declare class IllegalIssueStatusError extends Error {
    constructor(issueUrl: string, currentStatus: string, expectedStatus: string);
}
export declare class NotifyFinishedIssuePreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    constructor(projectRepository: ProjectRepository, issueRepository: IssueRepository);
    run: (params: {
        projectUrl: string;
        issueUrl: string;
        preparationStatus: string;
        awaitingQualityCheckStatus: string;
    }) => Promise<void>;
}
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.d.ts.map