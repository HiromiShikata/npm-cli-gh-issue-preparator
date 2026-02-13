"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = void 0;
class StartPreparationUseCase {
    constructor(projectRepository, issueRepository, localCommandRunner) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.localCommandRunner = localCommandRunner;
        this.run = async (params) => {
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const storyObjectMap = await this.issueRepository.getStoryObjectMap(project);
            const allIssues = await this.issueRepository.getAllOpened(project);
            const repositoryBlockerIssues = this.createWorkflowBockerIsues(storyObjectMap);
            const awaitingWorkspaceIssues = Array.from(storyObjectMap.values())
                .map((storyObject) => storyObject.issues)
                .flat()
                .filter((issue) => issue.status === params.awaitingWorkspaceStatus);
            const currentPreparationIssueCount = allIssues.filter((issue) => issue.status === params.preparationStatus).length;
            let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;
            for (let i = 0; i < maximumPreparingIssuesCount; i++) {
                const issue = awaitingWorkspaceIssues.pop();
                if (!issue) {
                    break;
                }
                const blockerIssueUrls = repositoryBlockerIssues.find((blocker) => issue.url.includes(blocker.orgRepo))?.blockerIssueUrls || [];
                if (blockerIssueUrls.length > 0 &&
                    !blockerIssueUrls.includes(issue.url)) {
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
                if (maximumPreparingIssuesCount !== null &&
                    updatedCurrentPreparationIssueCount >= maximumPreparingIssuesCount) {
                    break;
                }
            }
        };
        this.createWorkflowBockerIsues = (storyObjectMap) => {
            const workflowBlockerStory = Array.from(storyObjectMap.keys()).filter((storyName) => storyName.toLowerCase().includes('workflow blocker'));
            if (workflowBlockerStory.length === 0) {
                return [];
            }
            const result = storyObjectMap
                .get(workflowBlockerStory[0])
                ?.issues.filter((issue) => issue.state === 'OPEN')
                .map((issue) => {
                const orgRepo = issue.url.split('/issues')[0].split('github.com/')[1];
                return {
                    orgRepo,
                    blockerIssueUrls: [issue.url],
                };
            }) || [];
            return result;
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map