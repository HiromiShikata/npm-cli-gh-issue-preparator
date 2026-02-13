import {
  getStoryObjectMap,
  Issue as TowerDefenceIssue,
  Project as TowerDefenceProject,
  StoryObjectMap as TowerDefenceStoryObjectMap,
} from 'github-issue-tower-defence-management';
import { IssueRepository } from '../../domain/usecases/adapter-interfaces/IssueRepository';
import { Issue } from '../../domain/entities/Issue';
import { Project } from '../../domain/entities/Project';
import { StoryObjectMap } from '../../domain/entities/StoryObjectMap';

export class TowerDefenceIssueRepository implements Pick<
  IssueRepository,
  'getAllOpened' | 'getStoryObjectMap'
> {
  private cachedProject: TowerDefenceProject | null = null;
  private cachedIssues: TowerDefenceIssue[] | null = null;
  private storyObjectMap: TowerDefenceStoryObjectMap | null = null;

  constructor(
    private readonly configFilePath: string,
    _token: string,
  ) {}

  private async loadData(_project: Project): Promise<{
    project: TowerDefenceProject;
    issues: TowerDefenceIssue[];
    storyObjectMap: TowerDefenceStoryObjectMap;
  }> {
    if (this.cachedProject && this.cachedIssues && this.storyObjectMap) {
      return {
        project: this.cachedProject,
        issues: this.cachedIssues,
        storyObjectMap: this.storyObjectMap,
      };
    }

    const result = await getStoryObjectMap(this.configFilePath, true);
    this.cachedProject = result.project;
    this.cachedIssues = result.issues;
    this.storyObjectMap = result.storyObjectMap;
    return {
      project: result.project,
      issues: result.issues,
      storyObjectMap: result.storyObjectMap,
    };
  }

  async getAllOpened(project: Project): Promise<Issue[]> {
    const { issues } = await this.loadData(project);
    return issues
      .filter((issue) => issue.state === 'OPEN')
      .map((issue) => this.mapToIssue(issue));
  }
  getStoryObjectMap = async (project: Project): Promise<StoryObjectMap> => {
    const { storyObjectMap } = await this.loadData(project);

    return storyObjectMap;
  };

  private mapToIssue(towerDefenceIssue: TowerDefenceIssue): Issue {
    return {
      ...towerDefenceIssue,
    };
  }
}
