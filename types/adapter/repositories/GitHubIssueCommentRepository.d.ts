import { IssueCommentRepository } from '../../domain/usecases/adapter-interfaces/IssueCommentRepository';
import { Issue } from '../../domain/entities/Issue';
import { Comment } from '../../domain/entities/Comment';
export declare class GitHubIssueCommentRepository implements IssueCommentRepository {
  private readonly token;
  constructor(token: string);
  private parseIssueUrl;
  getCommentsFromIssue(issue: Issue): Promise<Comment[]>;
  private getIssueNodeId;
  createComment(issue: Issue, commentContent: string): Promise<void>;
}
//# sourceMappingURL=GitHubIssueCommentRepository.d.ts.map
