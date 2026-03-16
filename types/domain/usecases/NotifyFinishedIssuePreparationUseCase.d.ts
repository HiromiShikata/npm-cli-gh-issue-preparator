import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { WebhookRepository } from './adapter-interfaces/WebhookRepository';
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
  private readonly webhookRepository;
  constructor(
    projectRepository: Pick<ProjectRepository, 'getByUrl' | 'prepareStatus'>,
    issueRepository: Pick<
      IssueRepository,
      'get' | 'update' | 'findRelatedOpenPRs' | 'getStoryObjectMap'
    >,
    issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
    webhookRepository: Pick<WebhookRepository, 'sendGetRequest'>,
  );
  run: (params: {
    projectUrl: string;
    issueUrl: string;
    preparationStatus: string;
    awaitingWorkspaceStatus: string;
    awaitingQualityCheckStatus: string;
    thresholdForAutoReject: number;
    workflowBlockerResolvedWebhookUrl: string | null;
  }) => Promise<void>;
  private collectRejections;
  private sendWorkflowBlockerNotification;
}
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.d.ts.map
