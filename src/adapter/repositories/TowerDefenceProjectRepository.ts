import {
  getStoryObjectMap,
  Project as TowerDefenceProject,
} from 'github-issue-tower-defence-management';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { Project } from '../../domain/entities/Project';

export class TowerDefenceProjectRepository implements ProjectRepository {
  private cachedProject: TowerDefenceProject | null = null;
  private projectUrl: string | null = null;

  constructor(
    private readonly configFilePath: string,
    private readonly _token: string,
  ) {}

  private async loadProject(): Promise<TowerDefenceProject> {
    if (this.cachedProject) {
      return this.cachedProject;
    }

    const result = await getStoryObjectMap(this.configFilePath, false);
    this.cachedProject = result.project;
    return result.project;
  }

  async getByUrl(url: string): Promise<Project> {
    const towerDefenceProject = await this.loadProject();
    this.projectUrl = url;
    return this.mapToProject(towerDefenceProject, url);
  }

  async prepareStatus(_name: string, project: Project): Promise<Project> {
    return project;
  }

  private mapToProject(
    towerDefenceProject: TowerDefenceProject,
    url: string,
  ): Project {
    return {
      id: towerDefenceProject.id,
      url: url,
      databaseId: towerDefenceProject.databaseId,
      name: towerDefenceProject.name,
      status: towerDefenceProject.status,
      nextActionDate: towerDefenceProject.nextActionDate,
      nextActionHour: towerDefenceProject.nextActionHour,
      story: towerDefenceProject.story,
      remainingEstimationMinutes:
        towerDefenceProject.remainingEstimationMinutes,
      dependedIssueUrlSeparatedByComma:
        towerDefenceProject.dependedIssueUrlSeparatedByComma,
      completionDate50PercentConfidence:
        towerDefenceProject.completionDate50PercentConfidence,
    };
  }
}
