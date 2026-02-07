"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubIssueRepository = void 0;
function isIssueTimelineResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isProjectItemsResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isUpdateItemResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isStatusFieldsResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
class GitHubIssueRepository {
    constructor(token) {
        this.token = token;
    }
    parseProjectInfo(project) {
        const urlMatch = project.url.match(/github\.com\/(?:orgs|users)\/([^/]+)\/projects\/(\d+)/);
        if (!urlMatch) {
            throw new Error(`Invalid GitHub project URL: ${project.url}`);
        }
        const owner = urlMatch[1];
        const projectNumber = parseInt(urlMatch[2], 10);
        return { owner, projectNumber };
    }
    buildProjectItemsQuery() {
        return `
      query($owner: String!, $number: Int!, $after: String) {
        organization(login: $owner) {
          projectV2(number: $number) {
            items(first: 100, after: $after) {
              totalCount
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                id
                content {
                  ... on Issue {
                    url
                    title
                    number
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                    comments(first: 100) {
                      nodes {
                        author {
                          login
                        }
                        body
                        createdAt
                      }
                    }
                  }
                  ... on PullRequest {
                    url
                    title
                    number
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                    comments(first: 100) {
                      nodes {
                        author {
                          login
                        }
                        body
                        createdAt
                      }
                    }
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field {
                        ... on ProjectV2Field {
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
        user(login: $owner) {
          projectV2(number: $number) {
            items(first: 100, after: $after) {
              totalCount
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                id
                content {
                  ... on Issue {
                    url
                    title
                    number
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                    comments(first: 100) {
                      nodes {
                        author {
                          login
                        }
                        body
                        createdAt
                      }
                    }
                  }
                  ... on PullRequest {
                    url
                    title
                    number
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                    comments(first: 100) {
                      nodes {
                        author {
                          login
                        }
                        body
                        createdAt
                      }
                    }
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field {
                        ... on ProjectV2Field {
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
      }
    `;
    }
    mapCommentsToEntity(commentNodes) {
        if (!commentNodes)
            return [];
        return commentNodes.map((node) => ({
            author: node.author?.login || '',
            content: node.body,
            createdAt: new Date(node.createdAt),
        }));
    }
    async getStatusOptionId(project, statusName) {
        const { owner, projectNumber } = this.parseProjectInfo(project);
        const query = `
      query($owner: String!, $number: Int!, $after: String) {
        organization(login: $owner) {
          projectV2(number: $number) {
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
    async getAllOpened(project) {
        const { owner, projectNumber } = this.parseProjectInfo(project);
        const query = this.buildProjectItemsQuery();
        const issues = [];
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
                const errorText = await response.text();
                throw new Error(`GitHub API error: ${errorText}`);
            }
            const responseData = await response.json();
            if (!isProjectItemsResponse(responseData)) {
                throw new Error('Invalid API response format');
            }
            const result = responseData;
            const projectData = result.data?.organization?.projectV2 || result.data?.user?.projectV2;
            if (!projectData) {
                break;
            }
            const items = projectData.items.nodes;
            for (const item of items) {
                if (!item.content)
                    continue;
                const statusField = item.fieldValues?.nodes.find((fv) => fv.field?.name === 'Status');
                const status = statusField?.name || '';
                if (item.content.url === undefined) {
                    continue;
                }
                issues.push({
                    id: item.id,
                    url: item.content.url,
                    title: item.content.title,
                    labels: item.content.labels?.nodes?.map((l) => l.name) || [],
                    status,
                    comments: this.mapCommentsToEntity(item.content.comments?.nodes),
                });
            }
            hasNextPage = projectData.items.pageInfo.hasNextPage;
            after = projectData.items.pageInfo.endCursor;
        }
        return issues;
    }
    async update(issue, project) {
        const statusInfo = await this.getStatusOptionId(project, issue.status);
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
                    projectId: project.id,
                    itemId: issue.id,
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
    }
    async get(issueUrl, project) {
        const { owner, projectNumber } = this.parseProjectInfo(project);
        const query = this.buildProjectItemsQuery();
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
            if (!isProjectItemsResponse(responseData)) {
                return null;
            }
            const result = responseData;
            const projectData = result.data?.organization?.projectV2 || result.data?.user?.projectV2;
            if (!projectData) {
                return null;
            }
            const items = projectData.items.nodes;
            for (const item of items) {
                if (!item.content)
                    continue;
                if (item.content.url === issueUrl) {
                    const statusField = item.fieldValues?.nodes.find((fv) => fv.field?.name === 'Status');
                    const status = statusField?.name || '';
                    return {
                        id: item.id,
                        url: item.content.url,
                        title: item.content.title,
                        labels: item.content.labels?.nodes?.map((l) => l.name) || [],
                        status,
                        comments: this.mapCommentsToEntity(item.content.comments?.nodes),
                    };
                }
            }
            hasNextPage = projectData.items.pageInfo.hasNextPage;
            after = projectData.items.pageInfo.endCursor;
        }
        return null;
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
exports.GitHubIssueRepository = GitHubIssueRepository;
//# sourceMappingURL=GitHubIssueRepository.js.map