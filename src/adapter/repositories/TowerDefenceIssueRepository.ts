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
import { defaultSleep } from './GraphqlRateLimitHelper';

export class TowerDefenceIssueRepository implements Pick<
  IssueRepository,
  'getAllOpened' | 'getStoryObjectMap'
> {
  private cachedProject: TowerDefenceProject | null = null;
  private cachedIssues: TowerDefenceIssue[] | null = null;
  private storyObjectMap: TowerDefenceStoryObjectMap | null = null;
  private readonly retryDelaysMs: number[];
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly configFilePath: string,
    _token: string,
    retryDelaysMs: number[] = [5000, 15000, 45000],
    sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {
    this.retryDelaysMs = retryDelaysMs;
    this.sleep = sleep;
  }

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

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelaysMs[attempt - 1];
        console.log(
          `GitHub API error loading project data from ${this.configFilePath}, retrying in ${delay / 1000}s... (attempt ${attempt}/${this.retryDelaysMs.length})`,
        );
        await this.sleep(delay);
        this.cachedProject = null;
        this.cachedIssues = null;
        this.storyObjectMap = null;
      }

      try {
        const result = await getStoryObjectMap(this.configFilePath, true);
        this.cachedProject = result.project;
        this.cachedIssues = result.issues;
        this.storyObjectMap = result.storyObjectMap;
        return {
          project: result.project,
          issues: result.issues,
          storyObjectMap: result.storyObjectMap,
        };
      } catch (error) {
        if (error instanceof Error && !this.isTransientGitHubApiError(error)) {
          throw error;
        }
        lastError = error;
        console.warn(
          `Failed to load project data from ${this.configFilePath} (attempt ${attempt + 1}/${this.retryDelaysMs.length + 1}): ${error instanceof Error ? error.message : String(error)}`,
        );
        if (attempt < this.retryDelaysMs.length) continue;
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `GitHub API error loading project data from ${this.configFilePath}, all retries exhausted: ${errorMessage}`,
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
    const author =
      'author' in towerDefenceIssue &&
      typeof towerDefenceIssue.author === 'string'
        ? towerDefenceIssue.author
        : '';

    return {
      ...towerDefenceIssue,
      author,
    };
  }
}
