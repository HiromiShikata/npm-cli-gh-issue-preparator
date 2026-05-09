"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TowerDefenceIssueRepository = void 0;
const github_issue_tower_defence_management_1 = require("github-issue-tower-defence-management");
const GraphqlRateLimitHelper_1 = require("./GraphqlRateLimitHelper");
class TowerDefenceIssueRepository {
    constructor(configFilePath, _token, retryDelaysMs = [5000, 15000, 45000], sleep = GraphqlRateLimitHelper_1.defaultSleep) {
        this.configFilePath = configFilePath;
        this.cachedProject = null;
        this.cachedIssues = null;
        this.storyObjectMap = null;
        this.getStoryObjectMap = async (project) => {
            const { storyObjectMap } = await this.loadData(project);
            return storyObjectMap;
        };
        this.retryDelaysMs = retryDelaysMs;
        this.sleep = sleep;
    }
    async loadData(_project) {
        if (this.cachedProject && this.cachedIssues && this.storyObjectMap) {
            return {
                project: this.cachedProject,
                issues: this.cachedIssues,
                storyObjectMap: this.storyObjectMap,
            };
        }
        let lastError;
        for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
            if (attempt > 0) {
                const delay = this.retryDelaysMs[attempt - 1];
                console.log(`GitHub API error loading project data from ${this.configFilePath}, retrying in ${delay / 1000}s... (attempt ${attempt}/${this.retryDelaysMs.length})`);
                await this.sleep(delay);
                this.cachedProject = null;
                this.cachedIssues = null;
                this.storyObjectMap = null;
            }
            try {
                const result = await (0, github_issue_tower_defence_management_1.getStoryObjectMap)(this.configFilePath, true);
                this.cachedProject = result.project;
                this.cachedIssues = result.issues;
                this.storyObjectMap = result.storyObjectMap;
                return {
                    project: result.project,
                    issues: result.issues,
                    storyObjectMap: result.storyObjectMap,
                };
            }
            catch (error) {
                if (error instanceof Error && !this.isTransientGitHubApiError(error)) {
                    throw error;
                }
                lastError = error;
                console.warn(`Failed to load project data from ${this.configFilePath} (attempt ${attempt + 1}/${this.retryDelaysMs.length + 1}): ${error instanceof Error ? error.message : String(error)}`);
                if (attempt < this.retryDelaysMs.length)
                    continue;
            }
        }
        const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
        throw new Error(`GitHub API error loading project data from ${this.configFilePath}, all retries exhausted: ${errorMessage}`);
    }
    isTransientGitHubApiError(error) {
        if (error instanceof TypeError) {
            return /^Cannot read propert(?:y|ies) of (?:undefined|null)/.test(error.message);
        }
        const message = error.message;
        return (message.includes('ECONNRESET') ||
            message.includes('ETIMEDOUT') ||
            message.includes('ENOTFOUND') ||
            message.includes('fetch failed') ||
            message.includes('rate limit'));
    }
    async getAllOpened(project) {
        const { issues } = await this.loadData(project);
        return issues
            .filter((issue) => issue.state === 'OPEN')
            .map((issue) => this.mapToIssue(issue));
    }
    mapToIssue(towerDefenceIssue) {
        return {
            ...towerDefenceIssue,
        };
    }
}
exports.TowerDefenceIssueRepository = TowerDefenceIssueRepository;
//# sourceMappingURL=TowerDefenceIssueRepository.js.map