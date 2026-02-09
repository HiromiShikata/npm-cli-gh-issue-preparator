import { Issue } from '../../entities/Issue';

export type RelatedPullRequest = {
  url: string;
  isConflicted: boolean;
  isPassedAllCiJob: boolean;
  isResolvedAllReviewComments: boolean;
  isBranchOutOfDate: boolean;
};

export interface IssueRepository {
  getAllOpened(projectUrl: string): Promise<Issue[]>;
  get(issueUrl: string, projectUrl: string): Promise<Issue | null>;
  update(issue: Issue, projectUrl: string): Promise<void>;
  findRelatedOpenPRs(issueUrl: string): Promise<RelatedPullRequest[]>;
}
