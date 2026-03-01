"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TowerDefenceIssueRepository = void 0;
const github_issue_tower_defence_management_1 = require("github-issue-tower-defence-management");
class TowerDefenceIssueRepository {
    constructor(configFilePath, _token) {
        this.configFilePath = configFilePath;
        this.cachedProject = null;
        this.cachedIssues = null;
        this.storyObjectMap = null;
        this.getStoryObjectMap = async (project) => {
            const { storyObjectMap } = await this.loadData(project);
            return storyObjectMap;
        };
    }
    async loadData(_project) {
        if (this.cachedProject && this.cachedIssues && this.storyObjectMap) {
            return {
                project: this.cachedProject,
                issues: this.cachedIssues,
                storyObjectMap: this.storyObjectMap,
            };
        }
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
    async getAllOpened(project) {
        const { issues } = await this.loadData(project);
        return issues
            .filter((issue) => issue.state === 'OPEN')
            .map((issue) => this.mapToIssue(issue));
    }
    mapToIssue(towerDefenceIssue) {
        return {
            ...towerDefenceIssue,
            author: 'author' in towerDefenceIssue ? String(towerDefenceIssue.author) : '',
        };
    }
}
exports.TowerDefenceIssueRepository = TowerDefenceIssueRepository;
//# sourceMappingURL=TowerDefenceIssueRepository.js.map