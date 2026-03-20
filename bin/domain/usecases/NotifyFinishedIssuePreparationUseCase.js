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
    constructor(projectRepository, issueRepository, issueCommentRepository, webhookRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.issueCommentRepository = issueCommentRepository;
        this.webhookRepository = webhookRepository;
        this.run = async (params) => {
            let project = await this.projectRepository.getByUrl(params.projectUrl);
            project = await this.projectRepository.prepareStatus(params.preparationStatus, project);
            project = await this.projectRepository.prepareStatus(params.awaitingWorkspaceStatus, project);
            project = await this.projectRepository.prepareStatus(params.awaitingQualityCheckStatus, project);
            const issue = await this.issueRepository.get(params.issueUrl, project);
            if (!issue) {
                throw new IssueNotFoundError(params.issueUrl);
            }
            else if (issue.status !== params.preparationStatus) {
                throw new IllegalIssueStatusError(params.issueUrl, issue.status, params.preparationStatus);
            }
            if (issue.dependedIssueUrls.length === 0) {
                try {
                    const storyObjectMap = await this.issueRepository.getStoryObjectMap(project);
                    for (const storyObject of storyObjectMap.values()) {
                        const towerDefenceIssue = storyObject.issues.find((i) => i.url === issue.url);
                        if (towerDefenceIssue) {
                            issue.dependedIssueUrls = towerDefenceIssue.dependedIssueUrls;
                            break;
                        }
                    }
                }
                catch (error) {
                    console.warn('Failed to enrich dependedIssueUrls from story object map:', error);
                }
            }
            if (issue.dependedIssueUrls.length > 0) {
                issue.status = params.awaitingWorkspaceStatus;
                await this.issueRepository.update(issue, project);
                await this.issueCommentRepository.createComment(issue, `Issue has depended issue URLs: ${issue.dependedIssueUrls.join(', ')}`);
                return;
            }
            const comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
            const rejections = await this.collectRejections(issue, comments);
            const rejectionStatusMessage = rejections.length > 0
                ? `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`
                : 'Auto Status Check: APPROVED';
            const lastTargetComments = comments.slice(-params.thresholdForAutoReject * 2);
            if (lastTargetComments.filter((comment) => comment.content.startsWith('Auto Status Check: REJECTED')).length >= params.thresholdForAutoReject &&
                !lastTargetComments.some((comment) => comment.content
                    .toLowerCase()
                    .includes('failed to pass the check automatically'))) {
                issue.status = params.awaitingQualityCheckStatus;
                await this.issueRepository.update(issue, project);
                await this.issueCommentRepository.createComment(issue, `${rejectionStatusMessage}\n\nFailed to pass the check automatically for ${params.thresholdForAutoReject} times`);
                await this.sendWorkflowBlockerNotification(params.issueUrl, params.workflowBlockerResolvedWebhookUrl, project);
                return;
            }
            if (rejections.length <= 0) {
                issue.status = params.awaitingQualityCheckStatus;
                await this.issueRepository.update(issue, project);
                await this.sendWorkflowBlockerNotification(params.issueUrl, params.workflowBlockerResolvedWebhookUrl, project);
                return;
            }
            issue.status = params.awaitingWorkspaceStatus;
            await this.issueRepository.update(issue, project);
            await this.issueCommentRepository.createComment(issue, rejectionStatusMessage);
        };
        this.collectRejections = async (issue, comments) => {
            const rejections = [];
            const lastComment = comments[comments.length - 1];
            if (!lastComment || !lastComment.content.startsWith('From:')) {
                rejections.push({
                    type: 'NO_REPORT_FROM_AGENT_BOT',
                    detail: 'NO_REPORT_FROM_AGENT_BOT',
                });
            }
            else if (this.reportBodyHasNextStep(lastComment.content)) {
                rejections.push({
                    type: 'REPORT_HAS_NEXT_STEP',
                    detail: 'REPORT_HAS_NEXT_STEP',
                });
            }
            const categoryLabels = issue.labels.filter((label) => label.startsWith('category:'));
            if (categoryLabels.length <= 0 || categoryLabels.includes('category:e2e')) {
                const relatedOpenPrs = await this.issueRepository.findRelatedOpenPRs(issue.url);
                if (relatedOpenPrs.length <= 0) {
                    rejections.push({
                        type: 'PULL_REQUEST_NOT_FOUND',
                        detail: 'PULL_REQUEST_NOT_FOUND',
                    });
                }
                else if (relatedOpenPrs.length > 1) {
                    rejections.push({
                        type: 'MULTIPLE_PULL_REQUESTS_FOUND',
                        detail: `MULTIPLE_PULL_REQUESTS_FOUND: ${relatedOpenPrs.map((pr) => pr.url).join(', ')}`,
                    });
                }
                else {
                    const pr = relatedOpenPrs[0];
                    if (pr.isConflicted) {
                        rejections.push({
                            type: 'PULL_REQUEST_CONFLICTED',
                            detail: `PULL_REQUEST_CONFLICTED: ${pr.url}`,
                        });
                    }
                    if (!pr.isPassedAllCiJob) {
                        const missingChecks = pr.missingRequiredCheckNames;
                        const missingSuffix = missingChecks.length > 0
                            ? ` (missing: ${missingChecks.join(', ')})`
                            : '';
                        if (pr.isCiStateSuccess && missingChecks.length > 0) {
                            rejections.push({
                                type: 'REQUIRED_CI_JOB_NEVER_STARTED',
                                detail: `REQUIRED_CI_JOB_NEVER_STARTED: ${pr.url}${missingSuffix}`,
                            });
                        }
                        else {
                            rejections.push({
                                type: 'ANY_CI_JOB_FAILED_OR_IN_PROGRESS',
                                detail: `ANY_CI_JOB_FAILED_OR_IN_PROGRESS: ${pr.url}${missingSuffix}`,
                            });
                        }
                    }
                    if (!pr.isResolvedAllReviewComments) {
                        rejections.push({
                            type: 'ANY_REVIEW_COMMENT_NOT_RESOLVED',
                            detail: `ANY_REVIEW_COMMENT_NOT_RESOLVED: ${pr.url}`,
                        });
                    }
                }
            }
            return rejections;
        };
        this.reportBodyHasNextStep = (body) => {
            const reportMatch = body.match(/```json\n([\s\S]*?)\n```/);
            if (!reportMatch || reportMatch.length < 2) {
                return false;
            }
            let reportJson;
            try {
                reportJson = JSON.parse(reportMatch[1]);
            }
            catch (error) {
                console.warn('Invalid JSON in report body while checking nextStep:', error);
                return false;
            }
            if (typeof reportJson !== 'object' || reportJson === null) {
                return false;
            }
            if (!('nextStep' in reportJson)) {
                return false;
            }
            const nextStepValue = Reflect.get(reportJson, 'nextStep');
            return nextStepValue !== null && nextStepValue !== undefined;
        };
        this.sendWorkflowBlockerNotification = async (issueUrl, webhookUrlTemplate, project) => {
            if (webhookUrlTemplate === null) {
                return;
            }
            try {
                const storyObjectMap = await this.issueRepository.getStoryObjectMap(project);
                const isWorkflowBlocker = Array.from(storyObjectMap.entries()).some(([storyName, storyObject]) => storyName.toLowerCase().includes('workflow blocker') &&
                    storyObject.issues.some((issue) => issue.url === issueUrl));
                if (!isWorkflowBlocker) {
                    return;
                }
                const message = `Workflow blocker resolved: ${issueUrl}`;
                const webhookUrl = webhookUrlTemplate
                    .replace('{URL}', encodeURIComponent(issueUrl))
                    .replace('{MESSAGE}', encodeURIComponent(message));
                await this.webhookRepository.sendGetRequest(webhookUrl);
            }
            catch (error) {
                console.warn('Failed to send workflow blocker notification:', error);
            }
        };
    }
}
exports.NotifyFinishedIssuePreparationUseCase = NotifyFinishedIssuePreparationUseCase;
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.js.map