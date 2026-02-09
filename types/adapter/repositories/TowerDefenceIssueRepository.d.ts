import { Issue } from 'github-issue-tower-defence-management';
import {
  IssueRepository,
  RelatedPullRequest,
} from '../../domain/usecases/adapter-interfaces/IssueRepository';
export declare class TowerDefenceIssueRepository implements IssueRepository {
  private readonly configFilePath;
  private readonly token;
  private cachedProject;
  private cachedIssues;
  constructor(configFilePath: string, token: string);
  private parseProjectUrl;
  private loadData;
  getAllOpened(projectUrl: string): Promise<Issue[]>;
  get(issueUrl: string, projectUrl: string): Promise<Issue | null>;
  private getStatusOptionId;
  update(issue: Issue, projectUrl: string): Promise<void>;
  private parseIssueUrl;
  findRelatedOpenPRs(issueUrl: string): Promise<RelatedPullRequest[]>;
}
//# sourceMappingURL=TowerDefenceIssueRepository.d.ts.map
