import {
  IssueRepository,
  RelatedPullRequest,
} from '../../domain/usecases/adapter-interfaces/IssueRepository';
import { Issue } from '../../domain/entities/Issue';
import { Project } from '../../domain/entities/Project';
export declare class TowerDefenceIssueRepository implements IssueRepository {
  private readonly configFilePath;
  private readonly token;
  private cachedProject;
  private cachedIssues;
  constructor(configFilePath: string, token: string);
  private parseProjectUrl;
  private loadData;
  getAllOpened(project: Project): Promise<Issue[]>;
  get(issueUrl: string, project: Project): Promise<Issue | null>;
  private mapToIssue;
  private getStatusOptionId;
  update(issue: Issue, project: Project): Promise<void>;
  private parseIssueUrl;
  findRelatedOpenPRs(issueUrl: string): Promise<RelatedPullRequest[]>;
}
//# sourceMappingURL=TowerDefenceIssueRepository.d.ts.map
