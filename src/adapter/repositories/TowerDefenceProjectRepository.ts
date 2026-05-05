import {
  getStoryObjectMap,
  Project as TowerDefenceProject,
} from 'github-issue-tower-defence-management';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { Project } from '../../domain/entities/Project';
import { defaultSleep } from './GraphqlRateLimitHelper';

export class TowerDefenceProjectRepository implements ProjectRepository {
  private cachedProject: TowerDefenceProject | null = null;
  private projectUrl: string | null = null;
  private readonly retryDelaysMs: number[];
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly configFilePath: string,
    private readonly _token: string,
    retryDelaysMs: number[] = [5000, 15000, 45000],
    sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {
    this.retryDelaysMs = retryDelaysMs;
    this.sleep = sleep;
  }

  private async loadProject(): Promise<TowerDefenceProject> {
    if (this.cachedProject) {
      return this.cachedProject;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelaysMs[attempt - 1];
        console.log(
          `GitHub API error loading project from ${this.configFilePath}, retrying in ${delay / 1000}s... (attempt ${attempt}/${this.retryDelaysMs.length})`,
        );
        await this.sleep(delay);
        this.cachedProject = null;
      }

      try {
        const result = await getStoryObjectMap(this.configFilePath, false);
        this.cachedProject = result.project;
        return result.project;
      } catch (error) {
        if (error instanceof Error && !this.isTransientGitHubApiError(error)) {
          throw error;
        }
        lastError = error;
        console.warn(
          `Failed to load project from ${this.configFilePath} (attempt ${attempt + 1}/${this.retryDelaysMs.length + 1}): ${error instanceof Error ? error.message : String(error)}`,
        );
        if (attempt < this.retryDelaysMs.length) continue;
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `GitHub API error loading project from ${this.configFilePath}, all retries exhausted: ${errorMessage}`,
    );
  }

  private isTransientGitHubApiError(error: Error): boolean {
    if (error instanceof TypeError) {
      return true;
    }
    const message = error.message;
    return (
      message.includes('ECONNRESET') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ENOTFOUND') ||
      message.includes('fetch failed') ||
      message.includes('rate limit')
    );
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
      readme: null,
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

  async prepareCustomNumberField(
    _fieldName: string,
    project: Project,
  ): Promise<Project> {
    return project;
  }
}
