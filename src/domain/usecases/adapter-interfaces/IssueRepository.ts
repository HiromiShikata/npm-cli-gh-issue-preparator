import { Issue } from '../../entities/Issue';
import { Project } from '../../entities/Project';

export type RelatedPullRequest = {
  url: string;
  isConflicted: boolean;
  isPassedAllCiJob: boolean;
  isResolvedAllReviewComments: boolean;
  isBranchOutOfDate: boolean;
};

export interface IssueRepository {
  getAllOpened(project: Project): Promise<Issue[]>;
  get(issueUrl: string, project: Project): Promise<Issue | null>;
  update(issue: Issue, project: Project): Promise<void>;
  findRelatedOpenPRs(issueUrl: string): Promise<RelatedPullRequest[]>;
}
