import { IssueRepository } from '../../domain/usecases/adapter-interfaces/IssueRepository';
import { Issue } from '../../domain/entities/Issue';
import { Project } from '../../domain/entities/Project';
import { StoryObjectMap } from '../../domain/entities/StoryObjectMap';
export declare class TowerDefenceIssueRepository implements Pick<
  IssueRepository,
  'getAllOpened' | 'getStoryObjectMap'
> {
  private readonly configFilePath;
  private cachedProject;
  private cachedIssues;
  private storyObjectMap;
  private readonly retryDelaysMs;
  private readonly sleep;
  constructor(
    configFilePath: string,
    _token: string,
    retryDelaysMs?: number[],
    sleep?: (ms: number) => Promise<void>,
  );
  private loadData;
  private isTransientGitHubApiError;
  getAllOpened(project: Project): Promise<Issue[]>;
  getStoryObjectMap: (project: Project) => Promise<StoryObjectMap>;
  private mapToIssue;
}
//# sourceMappingURL=TowerDefenceIssueRepository.d.ts.map
