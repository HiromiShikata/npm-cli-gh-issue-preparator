"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = void 0;
class StartPreparationUseCase {
    constructor(projectRepository, issueRepository, localCommandRunner) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.localCommandRunner = localCommandRunner;
        this.parseMaximumPreparingIssuesCountFromReadme = (readme) => {
            if (!readme)
                return null;
            const match = readme.match(/maximumPreparingIssuesCount:\s*(\d+)/);
            if (!match)
                return null;
            return parseInt(match[1], 10);
        };
        this.run = async (params) => {
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ??
                this.parseMaximumPreparingIssuesCountFromReadme(project.readme) ??
                6;
            const allIssues = await this.issueRepository.getAllOpened(project);
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