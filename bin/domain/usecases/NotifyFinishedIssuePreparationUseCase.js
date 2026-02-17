"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifyFinishedIssuePreparationUseCase = exports.IllegalIssueStatusError = exports.IssueNotFoundError = void 0;
class IssueNotFoundError extends Error {
    constructor(issueUrl) {
        super(`Issue not found: ${issueUrl}`);
        this.name = 'IssueNotFoundError';
    }
}
exports.IssueNotFoundError = IssueNotFoundError;
class IllegalIssueStatusError extends Error {
    constructor(issueUrl, currentStatus, expectedStatus) {
        super(`Illegal issue status for ${issueUrl}: expected ${expectedStatus}, but got ${currentStatus}`);
        this.name = 'IllegalIssueStatusError';
    }
}
exports.IllegalIssueStatusError = IllegalIssueStatusError;
class NotifyFinishedIssuePreparationUseCase {
    constructor(projectRepository, issueRepository, issueCommentRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.issueCommentRepository = issueCommentRepository;
        this.run = async (params) => {
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const issue = await this.issueRepository.get(params.issueUrl, project);
            if (!issue) {
                throw new IssueNotFoundError(params.issueUrl);
            }
            else if (issue.status !== params.preparationStatus) {
                throw new IllegalIssueStatusError(params.issueUrl, issue.status, params.preparationStatus);
            }
            const comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
            const lastTargetComments = comments.slice(-params.thresholdForAutoReject * 2);
            if (lastTargetComments.filter((comment) => comment.content.startsWith('Auto Status Check: REJECTED')).length >= params.thresholdForAutoReject) {
                issue.status = params.awaitingQualityCheckStatus;
                await this.issueRepository.update(issue, project);
                await this.issueCommentRepository.createComment(issue, `Failed to pass the check autimatically for ${params.thresholdForAutoReject} times`);
                return;
            }
            const rejectedReasons = [];
            const lastComment = comments[comments.length - 1];
            if (!lastComment || !lastComment.content.startsWith('From:')) {
                rejectedReasons.push('NO_REPORT_FROM_AGENT_BOT');
            }
            const categoryLabels = issue.labels.filter((label) => label.startsWith('category:'));
            if (categoryLabels.length <= 0 || categoryLabels.includes('category:e2e')) {
                const relatedOpenPrs = await this.issueRepository.findRelatedOpenPRs(issue.url);
                if (relatedOpenPrs.length <= 0) {
                    rejectedReasons.push('PULL_REQUEST_NOT_FOUND');
                }
                else if (relatedOpenPrs.length > 1) {
                    rejectedReasons.push('MULTIPLE_PULL_REQUESTS_FOUND');
                }
                else {
                    const pr = relatedOpenPrs[0];
                    if (pr.isConflicted) {
                        rejectedReasons.push('PULL_REQUEST_CONFLICTED');
                    }
                    if (!pr.isPassedAllCiJob) {
                        rejectedReasons.push('ANY_CI_JOB_FAILED_OR_IN_PROGRESS');
                    }
                    if (!pr.isResolvedAllReviewComments) {
                        rejectedReasons.push('ANY_REVIEW_COMMENT_NOT_RESOLVED');
                    }
                }
            }
            if (rejectedReasons.length <= 0) {
                issue.status = params.awaitingQualityCheckStatus;
                await this.issueRepository.update(issue, project);
                return;
            }
            issue.status = params.awaitingWorkspaceStatus;
            await this.issueRepository.update(issue, project);
            await this.issueCommentRepository.createComment(issue, `Auto Status Check: REJECTED\n${rejectedReasons.map((v) => `- ${v}`).join('\n')}`);
        };
    }
}
exports.NotifyFinishedIssuePreparationUseCase = NotifyFinishedIssuePreparationUseCase;
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.js.map