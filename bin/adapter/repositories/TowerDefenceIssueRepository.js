"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TowerDefenceIssueRepository = void 0;
const github_issue_tower_defence_management_1 = require("github-issue-tower-defence-management");
function isIssueTimelineResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
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
class TowerDefenceIssueRepository {
    constructor(configFilePath, token) {
        this.configFilePath = configFilePath;
        this.token = token;
        this.cachedProject = null;
        this.cachedIssues = null;
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
    async loadData(_projectUrl) {
        if (this.cachedProject && this.cachedIssues) {
            return { project: this.cachedProject, issues: this.cachedIssues };
        }
        const result = await (0, github_issue_tower_defence_management_1.getStoryObjectMap)(this.configFilePath, false);
        this.cachedProject = result.project;
        this.cachedIssues = result.issues;
        return { project: result.project, issues: result.issues };
    }
    async getAllOpened(projectUrl) {
        const { issues } = await this.loadData(projectUrl);
        return issues.filter((issue) => issue.state === 'OPEN');
    }
    async get(issueUrl, projectUrl) {
        const { issues } = await this.loadData(projectUrl);
        return issues.find((issue) => issue.url === issueUrl) || null;
    }
    async getStatusOptionId(projectUrl, statusName) {
        if (!statusName) {
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
    async update(issue, projectUrl) {
        const statusInfo = await this.getStatusOptionId(projectUrl, issue.status);
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
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(`GitHub API error: ${JSON.stringify(responseData)}`);
        }
        if (typeof responseData === 'object' &&
            responseData !== null &&
            'errors' in responseData) {
            throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
        }
        if (!isUpdateItemResponse(responseData)) {
            throw new Error('Invalid API response format');
        }
        this.cachedIssues = null;
        this.cachedProject = null;
    }
    parseIssueUrl(issueUrl) {
        const urlMatch = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
        if (!urlMatch) {
            throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
        }
        return {
            owner: urlMatch[1],
            repo: urlMatch[2],
            issueNumber: parseInt(urlMatch[3], 10),
        };
    }
    async findRelatedOpenPRs(issueUrl) {
        const { owner, repo, issueNumber } = this.parseIssueUrl(issueUrl);
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
                      headRefName
                      commits(last: 1) {
                        nodes {
                          commit {
                            statusCheckRollup {
                              state
                            }
                          }
                        }
                      }
                      reviewThreads(first: 100) {
                        nodes {
                          isResolved
                        }
                      }
                      compareWithBaseRef {
                        behindBy
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
                throw new Error(`Failed to fetch issue timeline from GitHub GraphQL API: ${response.status} ${response.statusText}`);
            }
            const responseData = await response.json();
            if (!isIssueTimelineResponse(responseData)) {
                throw new Error('Unexpected response shape when fetching issue timeline from GitHub GraphQL API.');
            }
            const result = responseData;
            const issueData = result.data?.repository?.issue;
            if (!issueData) {
                throw new Error('Issue not found when fetching timeline from GitHub GraphQL API.');
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
                const isConflicted = pr.mergeable === 'CONFLICTING';
                const lastCommit = pr.commits?.nodes[0]?.commit;
                const ciState = lastCommit?.statusCheckRollup?.state;
                const isPassedAllCiJob = ciState === 'SUCCESS';
                const reviewThreads = pr.reviewThreads?.nodes || [];
                const isResolvedAllReviewComments = reviewThreads.length === 0 ||
                    reviewThreads.every((thread) => thread.isResolved);
                const behindBy = pr.compareWithBaseRef?.behindBy ?? 0;
                const isBranchOutOfDate = behindBy > 0;
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
exports.TowerDefenceIssueRepository = TowerDefenceIssueRepository;
//# sourceMappingURL=TowerDefenceIssueRepository.js.map