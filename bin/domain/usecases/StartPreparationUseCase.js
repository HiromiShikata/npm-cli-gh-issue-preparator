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
            try {
                const claudeUsages = await this.claudeRepository.getUsage();
                if (claudeUsages.some((usage) => usage.utilizationPercentage > params.utilizationPercentageThreshold)) {
                    console.warn('Claude usage limit exceeded. Skipping starting preparation.');
                    return;
                }
            }
            catch (error) {
                console.warn('Failed to check Claude usage:', error);
            }
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;
            let project = await this.projectRepository.getByUrl(params.projectUrl);
            project = await this.projectRepository.prepareStatus(params.awaitingWorkspaceStatus, project);
            project = await this.projectRepository.prepareStatus(params.preparationStatus, project);
            const storyObjectMap = await this.issueRepository.getStoryObjectMap(project);
            const allIssues = await this.issueRepository.getAllOpened(project);
            const repositoryBlockerIssues = this.createWorkflowBockerIsues(storyObjectMap);
            const awaitingWorkspaceIssues = Array.from(storyObjectMap.values())
                .map((storyObject) => storyObject.issues)
                .flat()
                .filter((issue) => issue.status === params.awaitingWorkspaceStatus);
            const currentPreparationIssueCount = allIssues.filter((issue) => issue.status === params.preparationStatus).length;
            let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;
            const now = new Date();
            const currentHour = now.getHours();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrowStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1);
            for (let i = 0; i < awaitingWorkspaceIssues.length &&
                updatedCurrentPreparationIssueCount < maximumPreparingIssuesCount; i++) {
                const issue = awaitingWorkspaceIssues[i];
                const blockerIssueUrls = repositoryBlockerIssues.find((blocker) => issue.url.includes(blocker.orgRepo))?.blockerIssueUrls || [];
                if (blockerIssueUrls.length > 0 &&
                    !blockerIssueUrls.includes(issue.url)) {
                    continue;
                }
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
                updatedCurrentPreparationIssueCount++;
            }
        };
        this.createWorkflowBockerIsues = (storyObjectMap) => {
            const workflowBlockerStory = Array.from(storyObjectMap.keys()).filter((storyName) => storyName.toLowerCase().includes('workflow blocker'));
            if (workflowBlockerStory.length === 0) {
                return [];
            }
            const aggregated = new Map();
            workflowBlockerStory.forEach((storyName) => {
                const issues = storyObjectMap
                    .get(storyName)
                    ?.issues.filter((issue) => issue.state === 'OPEN') || [];
                issues.forEach((issue) => {
                    const orgRepo = issue.url.split('/issues')[0].split('github.com/')[1];
                    const existing = aggregated.get(orgRepo) || [];
                    existing.push(issue.url);
                    aggregated.set(orgRepo, existing);
                });
            });
            return Array.from(aggregated.entries()).map(([orgRepo, blockerIssueUrls]) => ({
                orgRepo,
                blockerIssueUrls,
            }));
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map