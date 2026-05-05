"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TowerDefenceProjectRepository = void 0;
const github_issue_tower_defence_management_1 = require("github-issue-tower-defence-management");
const GraphqlRateLimitHelper_1 = require("./GraphqlRateLimitHelper");
class TowerDefenceProjectRepository {
    constructor(configFilePath, _token, retryDelaysMs = [5000, 15000, 45000], sleep = GraphqlRateLimitHelper_1.defaultSleep) {
        this.configFilePath = configFilePath;
        this._token = _token;
        this.cachedProject = null;
        this.projectUrl = null;
        this.retryDelaysMs = retryDelaysMs;
        this.sleep = sleep;
    }
    async loadProject() {
        if (this.cachedProject) {
            return this.cachedProject;
        }
        let lastError;
        for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
            if (attempt > 0) {
                const delay = this.retryDelaysMs[attempt - 1];
                console.log(`GitHub API error loading project from ${this.configFilePath}, retrying in ${delay / 1000}s... (attempt ${attempt}/${this.retryDelaysMs.length})`);
                await this.sleep(delay);
                this.cachedProject = null;
            }
            try {
                const result = await (0, github_issue_tower_defence_management_1.getStoryObjectMap)(this.configFilePath, false);
                this.cachedProject = result.project;
                return result.project;
            }
            catch (error) {
                if (error instanceof Error && !this.isTransientGitHubApiError(error)) {
                    throw error;
                }
                lastError = error;
                console.warn(`Failed to load project from ${this.configFilePath} (attempt ${attempt + 1}/${this.retryDelaysMs.length + 1}): ${error instanceof Error ? error.message : String(error)}`);
                if (attempt < this.retryDelaysMs.length)
                    continue;
            }
        }
        const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
        throw new Error(`GitHub API error loading project from ${this.configFilePath}, all retries exhausted: ${errorMessage}`);
    }
    isTransientGitHubApiError(error) {
        if (error instanceof TypeError) {
            return true;
        }
        const message = error.message;
        return (message.includes('ECONNRESET') ||
            message.includes('ETIMEDOUT') ||
            message.includes('ENOTFOUND') ||
            message.includes('fetch failed') ||
            message.includes('rate limit'));
    }
    async getByUrl(url) {
        const towerDefenceProject = await this.loadProject();
        this.projectUrl = url;
        return this.mapToProject(towerDefenceProject, url);
    }
    async prepareStatus(_name, project) {
        return project;
    }
    mapToProject(towerDefenceProject, url) {
        return {
            id: towerDefenceProject.id,
            url: url,
            databaseId: towerDefenceProject.databaseId,
            name: towerDefenceProject.name,
            readme: null,
            status: towerDefenceProject.status,
            nextActionDate: towerDefenceProject.nextActionDate,
            nextActionHour: towerDefenceProject.nextActionHour,
            story: towerDefenceProject.story,
            remainingEstimationMinutes: towerDefenceProject.remainingEstimationMinutes,
            dependedIssueUrlSeparatedByComma: towerDefenceProject.dependedIssueUrlSeparatedByComma,
            completionDate50PercentConfidence: towerDefenceProject.completionDate50PercentConfidence,
        };
    }
    async prepareCustomNumberField(_fieldName, project) {
        return project;
    }
}
exports.TowerDefenceProjectRepository = TowerDefenceProjectRepository;
//# sourceMappingURL=TowerDefenceProjectRepository.js.map