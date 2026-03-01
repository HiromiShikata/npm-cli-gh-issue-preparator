"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlIssueRepository = void 0;
const fnmatch = (pattern, str) => {
    let regexStr = '^';
    let i = 0;
    while (i < pattern.length) {
        const c = pattern[i];
        if (c === '*') {
            if (pattern[i + 1] === '*') {
                regexStr += '.*';
                i += 2;
                if (pattern[i] === '/') {
                    i++;
                }
            }
            else {
                regexStr += '[^/]*';
                i++;
            }
        }
        else if (c === '?') {
            regexStr += '[^/]';
            i++;
        }
        else if (c === '[') {
            let j = i + 1;
            while (j < pattern.length && pattern[j] !== ']') {
                j++;
            }
            if (j >= pattern.length) {
                regexStr += '\\[';
                i++;
                continue;
            }
            const content = pattern.slice(i + 1, j);
            if (content.length > 0 && (content[0] === '!' || content[0] === '^')) {
                const body = content.slice(1).replace(/\\/g, '\\\\');
                regexStr += '[^' + body + ']';
            }
            else {
                const escapedContent = content.replace(/\\/g, '\\\\');
                regexStr += '[' + escapedContent + ']';
            }
            i = j + 1;
        }
        else {
            regexStr += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            i++;
        }
    }
    regexStr += '$';
    try {
        const regex = new RegExp(regexStr);
        return regex.test(str);
    }
    catch {
        return pattern === str;
    }
};
function isStatusFieldsResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isUpdateItemResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isIssueTimelineResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isIssueResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
class GraphqlIssueRepository {
    constructor(token) {
        this.token = token;
    }
    async get(issueUrl, project) {
        const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issueUrl);
        const { projectNumber } = this.parseProjectUrl(project.url);
        const entityType = isPr ? 'pullRequest' : 'issue';
        const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          ${entityType}(number: $issueNumber) {
            number
            title
            state
            body
            createdAt
            url
            assignees(first: 100) {
              nodes {
                login
              }
            }
            labels(first: 100) {
              nodes {
                name
              }
            }
            projectItems(first: 100) {
              nodes {
                id
                project {
                  number
                }
                fieldValueByName(name: "Status") {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;
        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: {
                    owner,
                    repo,
                    issueNumber,
                },
            }),
        });
        // projectNumber is used below to filter project items, not in GraphQL query
        void projectNumber;
        if (!response.ok) {
            throw new Error('Failed to fetch issue from GitHub GraphQL API');
        }
        const responseData = await response.json();
        if (!isIssueResponse(responseData)) {
            throw new Error('Unexpected response shape when fetching issue');
        }
        const issueData = isPr
            ? responseData.data?.repository?.pullRequest
            : responseData.data?.repository?.issue;
        if (!issueData) {
            return null;
        }
        const projectItem = issueData.projectItems?.nodes.find((item) => item.project?.number === projectNumber);
        const mapState = (state) => {
            if (state === 'OPEN')
                return 'OPEN';
            if (state === 'CLOSED')
                return 'CLOSED';
            if (state === 'MERGED')
                return 'MERGED';
            return 'OPEN';
        };
        const issue = {
            nameWithOwner: `${owner}/${repo}`,
            number: issueData.number,
            title: issueData.title,
            state: mapState(issueData.state),
            status: projectItem?.fieldValueByName?.name ?? null,
            story: null,
            nextActionDate: null,
            nextActionHour: null,
            estimationMinutes: null,
            dependedIssueUrls: [],
            completionDate50PercentConfidence: null,
            url: issueData.url,
            assignees: issueData.assignees.nodes.map((a) => a.login),
            labels: issueData.labels.nodes.map((l) => l.name),
            org: owner,
            repo: repo,
            body: issueData.body,
            itemId: projectItem?.id ?? '',
            isPr,
            isInProgress: false,
            isClosed: issueData.state === 'CLOSED',
            createdAt: new Date(issueData.createdAt),
        };
        return issue;
    }
    parseProjectUrl(projectUrl) {
        const urlMatch = projectUrl.match(/github\.com\/(?:orgs|users)\/([^/]+)\/projects\/(\d+)/);
        if (!urlMatch) {
            throw new Error(`Invalid GitHub project URL: ${projectUrl}`);
        }
        const owner = urlMatch[1];
        const projectNumber = parseInt(urlMatch[2], 10);
        return { owner, projectNumber };
    }
    async getStatusOptionId(projectUrl, statusName) {
        if (statusName === null) {
            return null;
        }
        const { owner, projectNumber } = this.parseProjectUrl(projectUrl);
        const query = `
      query($owner: String!, $number: Int!, $after: String) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            fields(first: 100, after: $after) {
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
        user(login: $owner) {
          projectV2(number: $number) {
            id
            fields(first: 100, after: $after) {
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;
        let after = null;
        let hasNextPage = true;
        while (hasNextPage) {
            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        owner,
                        number: projectNumber,
                        after,
                    },
                }),
            });
            if (!response.ok) {
                return null;
            }
            const responseData = await response.json();
            if (!isStatusFieldsResponse(responseData)) {
                return null;
            }
            const result = responseData;
            const projectData = result.data?.organization?.projectV2 || result.data?.user?.projectV2;
            if (!projectData) {
                return null;
            }
            const fields = projectData.fields.nodes;
            const statusField = fields.find((f) => f.name === 'Status');
            if (statusField) {
                const option = statusField.options.find((o) => o.name === statusName);
                if (option) {
                    return {
                        projectId: projectData.id,
                        fieldId: statusField.id,
                        optionId: option.id,
                    };
                }
            }
            hasNextPage = projectData.fields.pageInfo.hasNextPage;
            after = projectData.fields.pageInfo.endCursor;
        }
        return null;
    }
    async update(issue, project) {
        const statusInfo = await this.getStatusOptionId(project.url, issue.status);
        if (!statusInfo) {
            throw new Error(`Status option not found for status: ${issue.status}`);
        }
        const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: $value
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;
        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: mutation,
                variables: {
                    projectId: statusInfo.projectId,
                    itemId: issue.itemId,
                    fieldId: statusInfo.fieldId,
                    value: { singleSelectOptionId: statusInfo.optionId },
                },
            }),
        });
        if (!response.ok) {
            throw new Error(`GitHub API error`);
        }
        const responseData = await response.json();
        if (!isUpdateItemResponse(responseData)) {
            throw new Error('Invalid API response format');
        }
        if (responseData.errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
        }
    }
    parseIssueUrl(issueUrl) {
        const urlMatch = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
        if (!urlMatch) {
            throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
        }
        return {
            owner: urlMatch[1],
            repo: urlMatch[2],
            issueNumber: parseInt(urlMatch[4], 10),
            isPr: urlMatch[3] === 'pull',
        };
    }
    async findRelatedOpenPRs(issueUrl) {
        const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issueUrl);
        if (isPr) {
            throw new Error('findRelatedOpenPRs only supports issue URLs, not pull request URLs');
        }
        const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            timelineItems(first: 100, after: $after, itemTypes: [CROSS_REFERENCED_EVENT]) {
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                __typename
                ... on CrossReferencedEvent {
                  willCloseTarget
                  source {
                    __typename
                    ... on PullRequest {
                      url
                      number
                      state
                      mergeable
                      baseRefName
                      baseRepository {
                        branchProtectionRules(first: 100) {
                          nodes {
                            pattern
                            requiredStatusCheckContexts
                          }
                        }
                        defaultBranchRef {
                          name
                        }
                        rulesets(first: 100) {
                          nodes {
                            name
                            enforcement
                            conditions {
                              refName {
                                include
                                exclude
                              }
                            }
                            rules(first: 100) {
                              nodes {
                                type
                                parameters {
                                  ... on RequiredStatusChecksParameters {
                                    requiredStatusChecks {
                                      context
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                      commits(last: 1) {
                        nodes {
                          commit {
                            statusCheckRollup {
                              state
                              contexts(first: 100) {
                                nodes {
                                  __typename
                                  ... on CheckRun {
                                    name
                                    conclusion
                                  }
                                  ... on StatusContext {
                                    context
                                    state
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                      reviewThreads(first: 100) {
                        nodes {
                          isResolved
                        }
                      }
                      baseRef {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
        const relatedPRsMap = new Map();
        let after = null;
        let hasNextPage = true;
        while (hasNextPage) {
            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        owner,
                        repo,
                        issueNumber,
                        after,
                    },
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch issue timeline from GitHub GraphQL API`);
            }
            const responseData = await response.json();
            if (!isIssueTimelineResponse(responseData)) {
                throw new Error('Unexpected response shape when fetching issue timeline from GitHub GraphQL API');
            }
            const result = responseData;
            const issueData = result.data?.repository?.issue;
            if (!issueData) {
                throw new Error('Issue not found when fetching timeline from GitHub GraphQL API');
            }
            const timelineItems = issueData.timelineItems.nodes;
            for (const item of timelineItems) {
                if (item.__typename !== 'CrossReferencedEvent')
                    continue;
                if (!item.source || item.source.__typename !== 'PullRequest')
                    continue;
                if (item.source.state !== 'OPEN')
                    continue;
                const pr = item.source;
                const prUrl = pr.url || '';
                const isConflicted = pr.mergeable !== 'MERGEABLE';
                const lastCommit = pr.commits?.nodes[0]?.commit;
                const ciState = lastCommit?.statusCheckRollup?.state;
                const contexts = lastCommit?.statusCheckRollup?.contexts?.nodes || [];
                const baseRefName = pr.baseRefName ?? pr.baseRef?.name;
                const branchProtectionRules = pr.baseRepository?.branchProtectionRules?.nodes || [];
                const matchingRules = baseRefName
                    ? branchProtectionRules.filter((rule) => rule.pattern === baseRefName ||
                        fnmatch(rule.pattern, baseRefName))
                    : [];
                const requiredCheckNamesSet = new Set();
                for (const rule of matchingRules) {
                    for (const name of rule.requiredStatusCheckContexts) {
                        requiredCheckNamesSet.add(name);
                    }
                }
                const rulesets = pr.baseRepository?.rulesets?.nodes || [];
                const defaultBranchName = pr.baseRepository?.defaultBranchRef?.name || '';
                for (const ruleset of rulesets) {
                    if (ruleset.enforcement !== 'ACTIVE')
                        continue;
                    const refIncludes = ruleset.conditions.refName.include;
                    const refExcludes = ruleset.conditions.refName.exclude;
                    const matchesInclude = baseRefName !== undefined &&
                        refIncludes.some((pattern) => {
                            if (pattern === '~DEFAULT_BRANCH') {
                                return baseRefName === defaultBranchName;
                            }
                            if (pattern === '~ALL') {
                                return true;
                            }
                            const branchPattern = pattern.replace(/^refs\/heads\//, '');
                            return (branchPattern === baseRefName ||
                                fnmatch(branchPattern, baseRefName));
                        });
                    if (!matchesInclude)
                        continue;
                    const matchesExclude = baseRefName !== undefined &&
                        refExcludes.some((pattern) => {
                            if (pattern === '~DEFAULT_BRANCH') {
                                return baseRefName === defaultBranchName;
                            }
                            const branchPattern = pattern.replace(/^refs\/heads\//, '');
                            return (branchPattern === baseRefName ||
                                fnmatch(branchPattern, baseRefName));
                        });
                    if (matchesExclude)
                        continue;
                    for (const rule of ruleset.rules.nodes) {
                        if (rule.type !== 'REQUIRED_STATUS_CHECKS')
                            continue;
                        if ('requiredStatusChecks' in rule.parameters) {
                            for (const check of rule.parameters.requiredStatusChecks) {
                                requiredCheckNamesSet.add(check.context);
                            }
                        }
                    }
                }
                const requiredCheckNames = Array.from(requiredCheckNamesSet);
                const passingConclusions = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);
                const passedContextNames = new Set();
                for (const ctx of contexts) {
                    if ('name' in ctx &&
                        ctx.conclusion &&
                        passingConclusions.has(ctx.conclusion)) {
                        passedContextNames.add(ctx.name);
                    }
                    if ('context' in ctx && ctx.state === 'SUCCESS') {
                        passedContextNames.add(ctx.context);
                    }
                }
                const allRequiredChecksPassed = requiredCheckNames.length === 0 ||
                    requiredCheckNames.every((name) => passedContextNames.has(name));
                const isPassedAllCiJob = ciState === 'SUCCESS' && allRequiredChecksPassed;
                const reviewThreads = pr.reviewThreads?.nodes || [];
                const isResolvedAllReviewComments = reviewThreads.length === 0 ||
                    reviewThreads.every((thread) => thread.isResolved);
                // Note: compareWithBaseRef is not available in GraphQL timeline items.
                // To get accurate behindBy, a separate API call per PR would be needed.
                // For now, we set isBranchOutOfDate to false. Conflicts are still detected via mergeable.
                const isBranchOutOfDate = false;
                relatedPRsMap.set(prUrl, {
                    url: prUrl,
                    isConflicted,
                    isPassedAllCiJob,
                    isResolvedAllReviewComments,
                    isBranchOutOfDate,
                });
            }
            hasNextPage = issueData.timelineItems.pageInfo.hasNextPage;
            after = issueData.timelineItems.pageInfo.endCursor;
        }
        return Array.from(relatedPRsMap.values());
    }
}
exports.GraphqlIssueRepository = GraphqlIssueRepository;
//# sourceMappingURL=GraphqlIssueRepository.js.map