import { GitHubIssueCommentRepository } from './GitHubIssueCommentRepository';
import { Issue } from '../../domain/entities/Issue';

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Backlog',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: 'testuser',
  ...overrides,
});

describe('GitHubIssueCommentRepository', () => {
  let repository: GitHubIssueCommentRepository;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    repository = new GitHubIssueCommentRepository('test-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCommentsFromIssue', () => {
    it('should return comments from issue', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                comments: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      author: { login: 'test-user' },
                      body: 'Test comment',
                      createdAt: '2024-01-01T00:00:00Z',
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.getCommentsFromIssue(mockIssue);

      expect(result).toHaveLength(1);
      expect(result[0].author).toBe('test-user');
      expect(result[0].content).toBe('Test comment');
    });

    it('should handle pagination', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                issue: {
                  comments: {
                    pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
                    nodes: [
                      {
                        author: { login: 'user1' },
                        body: 'Comment 1',
                        createdAt: '2024-01-01T00:00:00Z',
                      },
                    ],
                  },
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                issue: {
                  comments: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        author: { login: 'user2' },
                        body: 'Comment 2',
                        createdAt: '2024-01-02T00:00:00Z',
                      },
                    ],
                  },
                },
              },
            },
          }),
        });

      const result = await repository.getCommentsFromIssue(mockIssue);

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle missing author', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                comments: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      author: null,
                      body: 'Test comment',
                      createdAt: '2024-01-01T00:00:00Z',
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.getCommentsFromIssue(mockIssue);

      expect(result[0].author).toBe('');
    });

    it('should throw error for invalid issue URL', async () => {
      const mockIssue = createMockIssue({
        url: 'invalid-url',
      });

      await expect(repository.getCommentsFromIssue(mockIssue)).rejects.toThrow(
        'Invalid GitHub issue URL',
      );
    });

    it('should throw error when API response is not ok', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(repository.getCommentsFromIssue(mockIssue)).rejects.toThrow(
        'Failed to fetch comments from GitHub GraphQL API',
      );
    });

    it('should throw error when issue is not found', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: null,
            },
          },
        }),
      });

      await expect(repository.getCommentsFromIssue(mockIssue)).rejects.toThrow(
        'Issue not found when fetching comments',
      );
    });

    it('should throw error for invalid response shape', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'not an object',
      });

      await expect(repository.getCommentsFromIssue(mockIssue)).rejects.toThrow(
        'Unexpected response shape',
      );
    });

    it('should return comments from pull request', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/pull/5',
        isPr: true,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              pullRequest: {
                comments: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      author: { login: 'pr-user' },
                      body: 'PR comment',
                      createdAt: '2024-01-01T00:00:00Z',
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.getCommentsFromIssue(mockIssue);

      expect(result).toHaveLength(1);
      expect(result[0].author).toBe('pr-user');
      expect(result[0].content).toBe('PR comment');
    });

    it('should throw error when pull request is not found', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/pull/5',
        isPr: true,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              pullRequest: null,
            },
          },
        }),
      });

      await expect(repository.getCommentsFromIssue(mockIssue)).rejects.toThrow(
        'Pull request not found when fetching comments',
      );
    });
  });

  describe('createComment', () => {
    it('should create a comment on issue', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                issue: {
                  id: 'issue-node-id',
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              addComment: {
                commentEdge: {
                  node: {
                    id: 'comment-id',
                  },
                },
              },
            },
          }),
        });

      await repository.createComment(mockIssue, 'Test comment body');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when issue ID fetch fails', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        repository.createComment(mockIssue, 'Test comment'),
      ).rejects.toThrow('Failed to fetch issue ID from GitHub GraphQL API');
    });

    it('should throw error when issue is not found', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: null,
            },
          },
        }),
      });

      await expect(
        repository.createComment(mockIssue, 'Test comment'),
      ).rejects.toThrow('Issue not found when fetching issue ID');
    });

    it('should throw error when create comment API fails', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                issue: {
                  id: 'issue-node-id',
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

      await expect(
        repository.createComment(mockIssue, 'Test comment'),
      ).rejects.toThrow('Failed to create comment via GitHub GraphQL API');
    });

    it('should throw error when GraphQL returns errors', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                issue: {
                  id: 'issue-node-id',
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            errors: [{ message: 'GraphQL error' }],
          }),
        });

      await expect(
        repository.createComment(mockIssue, 'Test comment'),
      ).rejects.toThrow('GraphQL errors when creating comment');
    });

    it('should throw error for invalid issue URL when creating comment', async () => {
      const mockIssue = createMockIssue({
        url: 'invalid-url',
      });

      await expect(
        repository.createComment(mockIssue, 'Test comment'),
      ).rejects.toThrow('Invalid GitHub issue URL');
    });

    it('should throw error for invalid response shape when fetching issue ID', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'not an object',
      });

      await expect(
        repository.createComment(mockIssue, 'Test comment'),
      ).rejects.toThrow('Unexpected response shape');
    });

    it('should create a comment on pull request', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/pull/5',
        isPr: true,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                pullRequest: {
                  id: 'pr-node-id',
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              addComment: {
                commentEdge: {
                  node: {
                    id: 'comment-id',
                  },
                },
              },
            },
          }),
        });

      await repository.createComment(mockIssue, 'Test PR comment');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when pull request node ID is not found', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/pull/5',
        isPr: true,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              pullRequest: null,
            },
          },
        }),
      });

      await expect(
        repository.createComment(mockIssue, 'Test comment'),
      ).rejects.toThrow('Pull request not found when fetching issue ID');
    });

    it('should throw error for invalid response shape when creating comment', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                issue: {
                  id: 'issue-node-id',
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null,
        });

      await expect(
        repository.createComment(mockIssue, 'Test comment'),
      ).rejects.toThrow('Invalid API response format when creating comment');
    });
  });
});
