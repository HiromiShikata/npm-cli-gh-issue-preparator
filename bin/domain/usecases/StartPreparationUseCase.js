"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = void 0;
class StartPreparationUseCase {
    constructor(projectRepository, issueRepository, claudeRepository, localCommandRunner) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.claudeRepository = claudeRepository;
        this.localCommandRunner = localCommandRunner;
        this.run = async (params) => {
            const isAvailable = await this.claudeRepository.isClaudeAvailable(params.utilizationPercentageThreshold);
            if (!isAvailable) {
                console.warn('Claude is unavailable: no configured credentials found or all credentials are at capacity');
                return;
            }
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;
            let project = await this.projectRepository.getByUrl(params.projectUrl);
            project = await this.projectRepository.prepareStatus(params.awaitingWorkspaceStatus, project);
            project = await this.projectRepository.prepareStatus(params.preparationStatus, project);
            const storyObjectMap = await this.issueRepository.getStoryObjectMap(project);
            const allIssues = await this.issueRepository.getAllOpened(project);
            const awaitingWorkspaceIssues = Array.from(storyObjectMap.values())
                .map((storyObject) => storyObject.issues)
                .flat()
                .filter((issue) => issue.status === params.awaitingWorkspaceStatus)
                .map((issue) => ({
                ...issue,
                author: 'author' in issue && typeof issue.author === 'string'
                    ? issue.author
                    : '',
            }));
            const currentPreparationIssueCount = allIssues.filter((issue) => issue.status === params.preparationStatus).length;
            let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;
            const now = new Date();
            const currentHour = now.getHours();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrowStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1);
            for (let i = 0; i < awaitingWorkspaceIssues.length &&
                updatedCurrentPreparationIssueCount < maximumPreparingIssuesCount; i++) {
                const issue = awaitingWorkspaceIssues[i];
                if (issue.dependedIssueUrls.length > 0) {
                    continue;
                }
                if (issue.nextActionDate !== null &&
                    issue.nextActionDate >= tomorrowStart) {
                    continue;
                }
                if (issue.nextActionHour !== null && currentHour < issue.nextActionHour) {
                    continue;
                }
                if (params.allowedIssueAuthors !== null &&
                    issue.author !== '' &&
                    !params.allowedIssueAuthors.includes(issue.author)) {
                    continue;
                }
                const agent = issue.labels
                    .find((label) => label.startsWith('llm-agent:'))
                    ?.replace('llm-agent:', '')
                    .trim() ||
                    issue.labels
                        .find((label) => label.startsWith('category:'))
                        ?.replace('category:', '')
                        .trim() ||
                    params.defaultLlmAgentName ||
                    params.defaultAgentName;
                const model = issue.labels
                    .find((label) => label.startsWith('llm-model:'))
                    ?.replace('llm-model:', '')
                    .trim() ||
                    params.defaultLlmModelName ||
                    'claude-sonnet-4.6';
                const isPrUrl = issue.url.includes('/pull/');
                let existingPRBranchName = null;
                if (isPrUrl) {
                    const pr = await this.issueRepository.getOpenPullRequest(issue.url);
                    existingPRBranchName = pr?.branchName ?? null;
                }
                else {
                    const relatedPRs = await this.issueRepository.findRelatedOpenPRs(issue.url);
                    existingPRBranchName =
                        relatedPRs.length === 1 ? relatedPRs[0].branchName : null;
                }
                issue.status = params.preparationStatus;
                await this.issueRepository.update(issue, project);
                const logFilePathArg = params.logFilePath
                    ? `--logFilePath ${params.logFilePath}`
                    : null;
                const branchArg = existingPRBranchName !== null
                    ? ` --branch ${existingPRBranchName}`
                    : '';
                const command = `aw ${issue.url} ${agent} ${model} ${project.url}${logFilePathArg !== null ? ` ${logFilePathArg}` : ''}${branchArg}`;
                await this.localCommandRunner.runCommand(command);
                updatedCurrentPreparationIssueCount++;
            }
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map