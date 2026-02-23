import { IssueCommentRepository } from '../../domain/usecases/adapter-interfaces/IssueCommentRepository';
import { Issue } from '../../domain/entities/Issue';
import { Comment } from '../../domain/entities/Comment';

type CommentNode = {
  author: {
    login: string;
  } | null;
  body: string;
  createdAt: string;
};

type CommentsData = {
  comments: {
    pageInfo: {
      endCursor: string;
      hasNextPage: boolean;
    };
    nodes: CommentNode[];
  };
};

type IssueCommentsResponse = {
  data?: {
    repository?: {
      issue?: CommentsData;
      pullRequest?: CommentsData;
    };
  };
};

type CreateCommentResponse = {
  data?: {
    addComment?: {
      commentEdge: {
        node: {
          id: string;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
};

type IssueIdResponse = {
  data?: {
    repository?: {
      issue?: {
        id: string;
      };
      pullRequest?: {
        id: string;
      };
    };
  };
};

function isIssueCommentsResponse(
  value: unknown,
): value is IssueCommentsResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

function isCreateCommentResponse(
  value: unknown,
): value is CreateCommentResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

function isIssueIdResponse(value: unknown): value is IssueIdResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

export class GitHubIssueCommentRepository implements IssueCommentRepository {
  constructor(private readonly token: string) {}

  private parseIssueUrl(issue: Issue): {
    owner: string;
    repo: string;
    issueNumber: number;
    isPr: boolean;
  } {
    const urlMatch = issue.url.match(
      /github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
    );
    if (!urlMatch) {
      throw new Error(`Invalid GitHub issue URL: ${issue.url}`);
    }
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      issueNumber: parseInt(urlMatch[4], 10),
      isPr: urlMatch[3] === 'pull',
    };
  }

  async getCommentsFromIssue(issue: Issue): Promise<Comment[]> {
    const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issue);

    const entityType = isPr ? 'pullRequest' : 'issue';
    const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
          ${entityType}(number: $issueNumber) {
            comments(first: 100, after: $after) {
              pageInfo {
                endCursor
                hasNextPage
              }
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
      }
    `;

    const comments: Comment[] = [];
    let after: string | null = null;
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
        throw new Error(
          `Failed to fetch comments from GitHub GraphQL API: ${response.status} ${response.statusText}`,
        );
      }

      const responseData: unknown = await response.json();
      if (!isIssueCommentsResponse(responseData)) {
        throw new Error(
          'Unexpected response shape when fetching comments from GitHub GraphQL API',
        );
      }

      const issueData = isPr
        ? responseData.data?.repository?.pullRequest
        : responseData.data?.repository?.issue;
      if (!issueData) {
        throw new Error(
          `${isPr ? 'Pull request' : 'Issue'} not found when fetching comments from GitHub GraphQL API`,
        );
      }

      const commentNodes = issueData.comments.nodes;
      for (const node of commentNodes) {
        comments.push({
          author: node.author?.login || '',
          content: node.body,
          createdAt: new Date(node.createdAt),
        });
      }

      hasNextPage = issueData.comments.pageInfo.hasNextPage;
      after = issueData.comments.pageInfo.endCursor;
    }

    return comments;
  }

  private async getIssueNodeId(issue: Issue): Promise<string> {
    const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issue);

    const entityType = isPr ? 'pullRequest' : 'issue';
    const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          ${entityType}(number: $issueNumber) {
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
        query,
        variables: {
          owner,
          repo,
          issueNumber,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch issue ID from GitHub GraphQL API: ${response.status} ${response.statusText}`,
      );
    }

    const responseData: unknown = await response.json();
    if (!isIssueIdResponse(responseData)) {
      throw new Error(
        'Unexpected response shape when fetching issue ID from GitHub GraphQL API',
      );
    }

    const issueId = isPr
      ? responseData.data?.repository?.pullRequest?.id
      : responseData.data?.repository?.issue?.id;
    if (!issueId) {
      throw new Error(
        `${isPr ? 'Pull request' : 'Issue'} not found when fetching issue ID from GitHub GraphQL API`,
      );
    }

    return issueId;
  }

  async createComment(issue: Issue, commentContent: string): Promise<void> {
    const issueId = await this.getIssueNodeId(issue);

    const mutation = `
      mutation($issueId: ID!, $body: String!) {
        addComment(input: {
          subjectId: $issueId
          body: $body
        }) {
          commentEdge {
            node {
              id
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
        query: mutation,
        variables: {
          issueId,
          body: commentContent,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create comment via GitHub GraphQL API: ${response.status} ${response.statusText}`,
      );
    }

    const responseData: unknown = await response.json();
    if (!isCreateCommentResponse(responseData)) {
      throw new Error('Invalid API response format when creating comment');
    }

    if (responseData.errors) {
      throw new Error(
        `GraphQL errors when creating comment: ${JSON.stringify(responseData.errors)}`,
      );
    }
  }
}
