import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';
export declare class StartPreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly claudeRepository;
    private readonly localCommandRunner;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl'>, issueRepository: Pick<IssueRepository, 'getAllOpened' | 'getStoryObjectMap' | 'update'>, claudeRepository: Pick<ClaudeRepository, 'getUsage'>, localCommandRunner: LocalCommandRunner);
    run: (params: {
        projectUrl: string;
        awaitingWorkspaceStatus: string;
        preparationStatus: string;
        defaultAgentName: string;
        logFilePath?: string;
        maximumPreparingIssuesCount: number | null;
        utilizationPercentageThreshold: number;
    }) => Promise<void>;
    createWorkflowBockerIsues: (storyObjectMap: StoryObjectMap) => {
        orgRepo: string;
        blockerIssueUrls: string[];
    }[];
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map