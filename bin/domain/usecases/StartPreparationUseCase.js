"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = void 0;
class StartPreparationUseCase {
    constructor(projectRepository, issueRepository, localCommandRunner) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.localCommandRunner = localCommandRunner;
        this.maximumPreparingIssuesCount = 6;
        this.run = async (params) => {
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const allIssues = await this.issueRepository.getAllOpened(project);
            const awaitingWorkspaceIssues = allIssues.filter((issue) => issue.status === params.awaitingWorkspaceStatus);
            const currentPreparationIssueCount = allIssues.filter((issue) => issue.status === params.preparationStatus).length;
            const targetCount = Math.min(this.maximumPreparingIssuesCount, awaitingWorkspaceIssues.length + currentPreparationIssueCount);
            for (const issue of awaitingWorkspaceIssues.slice(0, targetCount - currentPreparationIssueCount)) {
                const agent = issue.labels
                    .find((label) => label.startsWith('category:'))
                    ?.replace('category:', '')
                    .trim() || params.defaultAgentName;
                issue.status = params.preparationStatus;
                await this.issueRepository.update(issue, project);
                await this.localCommandRunner.runCommand(`aw ${issue.url} ${agent} ${project.url}`);
            }
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map