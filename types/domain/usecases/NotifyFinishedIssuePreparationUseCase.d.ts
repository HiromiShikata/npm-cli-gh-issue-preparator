import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
export declare class IssueNotFoundError extends Error {
  constructor(issueUrl: string);
}
export declare class IllegalIssueStatusError extends Error {
  constructor(
    issueUrl: string,
    currentStatus: string | null,
    expectedStatus: string | null,
  );
}
export declare class NotifyFinishedIssuePreparationUseCase {
  private readonly projectRepository;
  private readonly issueRepository;
  private readonly issueCommentRepository;
  constructor(
    projectRepository: Pick<ProjectRepository, 'getByUrl'>,
    issueRepository: Pick<
      IssueRepository,
      'get' | 'update' | 'findRelatedOpenPRs'
    >,
    issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
  );
  run: (params: {
    projectUrl: string;
    issueUrl: string;
    preparationStatus: string;
    awaitingWorkspaceStatus: string;
    awaitingQualityCheckStatus: string;
    thresholdForAutoReject: number;
  }) => Promise<void>;
}
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.d.ts.map
