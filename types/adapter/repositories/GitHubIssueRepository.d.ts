import {
  IssueRepository,
  RelatedPullRequest,
} from '../../domain/usecases/adapter-interfaces/IssueRepository';
import { Issue } from '../../domain/entities/Issue';
import { Project } from '../../domain/entities/Project';
export declare class GitHubIssueRepository implements IssueRepository {
  private readonly token;
  constructor(token: string);
  private parseProjectInfo;
  private buildProjectItemsQuery;
  private mapCommentsToEntity;
  private getStatusOptionId;
  getAllOpened(project: Project): Promise<Issue[]>;
  update(issue: Issue, project: Project): Promise<void>;
  get(issueUrl: string, project: Project): Promise<Issue | null>;
  private parseIssueUrl;
  findRelatedOpenPRs(issueUrl: string): Promise<RelatedPullRequest[]>;
}
//# sourceMappingURL=GitHubIssueRepository.d.ts.map
