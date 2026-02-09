"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = void 0;
class StartPreparationUseCase {
    constructor(issueRepository, localCommandRunner) {
        this.issueRepository = issueRepository;
        this.localCommandRunner = localCommandRunner;
        this.run = async (params) => {
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;
            const allIssues = await this.issueRepository.getAllOpened(params.projectUrl);
            const awaitingWorkspaceIssues = allIssues.filter((issue) => issue.status === params.awaitingWorkspaceStatus);
            const currentPreparationIssueCount = allIssues.filter((issue) => issue.status === params.preparationStatus).length;
            for (let i = currentPreparationIssueCount; i <
                Math.min(maximumPreparingIssuesCount, awaitingWorkspaceIssues.length + currentPreparationIssueCount); i++) {
                const issue = awaitingWorkspaceIssues.pop();
                if (!issue) {
                    break;
                }
                const agent = issue.labels
                    .find((label) => label.startsWith('category:'))
                    ?.replace('category:', '')
                    .trim() || params.defaultAgentName;
                issue.status = params.preparationStatus;
                await this.issueRepository.update(issue, params.projectUrl);
                const logFilePathArg = params.logFilePath
                    ? `--logFilePath ${params.logFilePath}`
                    : '';
                await this.localCommandRunner.runCommand(`aw ${issue.url} ${agent} ${params.projectUrl}${logFilePathArg ? ` ${logFilePathArg}` : ''}`);
            }
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map