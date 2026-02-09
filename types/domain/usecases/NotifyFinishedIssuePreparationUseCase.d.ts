import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class IssueNotFoundError extends Error {
  constructor(issueUrl: string);
}
export declare class IllegalIssueStatusError extends Error {
  constructor(
    issueUrl: string,
    currentStatus: string | null,
    expectedStatus: string,
  );
}
export declare class NotifyFinishedIssuePreparationUseCase {
  private readonly issueRepository;
  constructor(issueRepository: IssueRepository);
  run: (params: {
    projectUrl: string;
    issueUrl: string;
    preparationStatus: string;
    awaitingQualityCheckStatus: string;
  }) => Promise<void>;
}
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.d.ts.map
