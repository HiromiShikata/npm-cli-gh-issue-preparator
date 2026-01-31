import { Issue } from '../../entities/Issue';
import { Project } from '../../entities/Project';
export interface IssueRepository {
  getAllOpened(project: Project): Promise<Issue[]>;
  get(issueUrl: string, project: Project): Promise<Issue | null>;
  update(issue: Issue, project: Project): Promise<void>;
}
//# sourceMappingURL=IssueRepository.d.ts.map
