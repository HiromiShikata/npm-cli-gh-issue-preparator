"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TowerDefenceProjectRepository = void 0;
const github_issue_tower_defence_management_1 = require("github-issue-tower-defence-management");
class TowerDefenceProjectRepository {
    constructor(configFilePath, _token) {
        this.configFilePath = configFilePath;
        this._token = _token;
        this.cachedProject = null;
        this.projectUrl = null;
    }
    async loadProject() {
        if (this.cachedProject) {
            return this.cachedProject;
        }
        const result = await (0, github_issue_tower_defence_management_1.getStoryObjectMap)(this.configFilePath, false);
        this.cachedProject = result.project;
        return result.project;
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