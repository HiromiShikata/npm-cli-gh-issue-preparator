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
            const lastThreeComments = comments.slice(-params.thresholdForAutoReject);
            if (lastThreeComments.length === params.thresholdForAutoReject &&
                lastThreeComments.every((comment) => comment.content.startsWith('Auto Status Check: REJECTED'))) {
                issue.status = params.awaitingQualityCheckStatus;
                await this.issueRepository.update(issue, project);
                await this.issueCommentRepository.createComment(issue, `Failed to pass the check autimatically for ${params.thresholdForAutoReject} times`);
                return;
            }
            const rejectReason = [];
            const lastComment = comments[comments.length - 1];
            if (!lastComment || !lastComment.content.startsWith('From: ')) {
                rejectReason.push('NO_REPORT');
            }
            if (rejectReason.length <= 0) {
                issue.status = params.awaitingQualityCheckStatus;
                await this.issueRepository.update(issue, project);
                return;
            }
            issue.status = params.awaitingWorkspaceStatus;
            await this.issueRepository.update(issue, project);
            await this.issueCommentRepository.createComment(issue, `
Auto Status Check: REJECTED
${JSON.stringify(rejectReason)}`);
        };
    }
}
exports.NotifyFinishedIssuePreparationUseCase = NotifyFinishedIssuePreparationUseCase;
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.js.map