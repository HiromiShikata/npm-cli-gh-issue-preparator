import { IssueRepository, RelatedPullRequest } from '../../domain/usecases/adapter-interfaces/IssueRepository';
import { Issue } from '../../domain/entities/Issue';
import { Project } from '../../domain/entities/Project';
export declare class GraphqlIssueRepository implements Pick<IssueRepository, 'get' | 'update' | 'findRelatedOpenPRs'> {
    private readonly token;
    constructor(token: string);
    get(issueUrl: string, project: Project): Promise<Issue | null>;
    private parseProjectUrl;
    private getStatusOptionId;
    update(issue: Issue, project: Project): Promise<void>;
    private parseIssueUrl;
    findRelatedOpenPRs(issueUrl: string): Promise<RelatedPullRequest[]>;
}
//# sourceMappingURL=GraphqlIssueRepository.d.ts.map