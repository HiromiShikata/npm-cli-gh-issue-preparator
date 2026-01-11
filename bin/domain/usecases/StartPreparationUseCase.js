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
            for (let i = currentPreparationIssueCount; i <
                Math.min(this.maximumPreparingIssuesCount, awaitingWorkspaceIssues.length + currentPreparationIssueCount); i++) {
                const issue = awaitingWorkspaceIssues.pop();
                if (!issue) {
                    break;
                }
                const agent = issue.labels
                    .find((label) => label.startsWith('category:'))
                    ?.replace('category:', '')
                    .trim() || params.defaultAgentName;
                issue.status = params.preparationStatus;
                await this.issueRepository.update(issue, project);
                const logFilePathArg = params.logFilePath
                    ? `--logFilePath ${params.logFilePath}`
                    : '';
                await this.localCommandRunner.runCommand(`aw ${issue.url} ${agent} ${project.url}${logFilePathArg ? ` ${logFilePathArg}` : ''}`);
            }
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map