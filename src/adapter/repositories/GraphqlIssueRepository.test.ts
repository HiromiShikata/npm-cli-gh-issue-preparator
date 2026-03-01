import { GraphqlIssueRepository } from './GraphqlIssueRepository';
import { Issue } from '../../domain/entities/Issue';
import { Project } from '../../domain/entities/Project';

const createMockProject = (): Project => ({
  id: 'proj-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

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

describe('GraphqlIssueRepository', () => {
  let repository: GraphqlIssueRepository;
  let mockFetch: jest.Mock;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    repository = new GraphqlIssueRepository('test-token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('update', () => {
    it('should update issue status via GraphQL', async () => {
      const mockIssue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-123',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              user: {
                projectV2: {
                  id: 'proj-123',
                  fields: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        id: 'field-1',
                        name: 'Status',
                        options: [
                          { id: 'opt-1', name: 'Backlog' },
                          { id: 'opt-2', name: 'Preparation' },
                        ],
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
              updateProjectV2ItemFieldValue: {
                projectV2Item: { id: 'item-123' },
              },
            },
          }),
        });

      await repository.update(mockIssue, createMockProject());

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should update PR status via GraphQL', async () => {
      const mockIssue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-123',
        url: 'https://github.com/user/repo/pull/5',
        isPr: true,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              user: {
                projectV2: {
                  id: 'proj-123',
                  fields: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        id: 'field-1',
                        name: 'Status',
                        options: [
                          { id: 'opt-1', name: 'Backlog' },
                          { id: 'opt-2', name: 'Preparation' },
                        ],
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
              updateProjectV2ItemFieldValue: {
                projectV2Item: { id: 'item-123' },
              },
            },
          }),
        });

      await repository.update(mockIssue, createMockProject());

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error for invalid project URL', async () => {
      const mockIssue = createMockIssue({ status: 'Preparation' });

      const invalidProject = {
        ...createMockProject(),
        url: 'invalid-url',
      };

      await expect(
        repository.update(mockIssue, invalidProject),
      ).rejects.toThrow('Invalid GitHub project URL');
    });

    it('should throw error when status option not found', async () => {
      const mockIssue = createMockIssue({ status: 'NonExistentStatus' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: {
              projectV2: {
                id: 'proj-123',
                fields: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'Status',
                      options: [{ id: 'opt-1', name: 'Backlog' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      await expect(
        repository.update(mockIssue, createMockProject()),
      ).rejects.toThrow(
        'Status option not found for status: NonExistentStatus',
      );
    });

    it('should return null for getStatusOptionId when statusName is null', async () => {
      const mockIssue = createMockIssue({ status: null });

      await expect(
        repository.update(mockIssue, createMockProject()),
      ).rejects.toThrow('Status option not found for status: null');
    });

    it('should return null when API response is not ok', async () => {
      const mockIssue = createMockIssue({ status: 'Preparation' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      await expect(
        repository.update(mockIssue, createMockProject()),
      ).rejects.toThrow('Status option not found for status: Preparation');
    });

    it('should throw error when update API response is not ok', async () => {
      const mockIssue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-123',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              user: {
                projectV2: {
                  id: 'proj-123',
                  fields: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        id: 'field-1',
                        name: 'Status',
                        options: [{ id: 'opt-2', name: 'Preparation' }],
                      },
                    ],
                  },
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'API Error' }),
        });

      await expect(
        repository.update(mockIssue, createMockProject()),
      ).rejects.toThrow('GitHub API error');
    });

    it('should throw error when GraphQL response contains errors', async () => {
      const mockIssue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-123',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              user: {
                projectV2: {
                  id: 'proj-123',
                  fields: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        id: 'field-1',
                        name: 'Status',
                        options: [{ id: 'opt-2', name: 'Preparation' }],
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
            errors: [{ message: 'GraphQL error' }],
          }),
        });

      await expect(
        repository.update(mockIssue, createMockProject()),
      ).rejects.toThrow('GraphQL errors');
    });

    it('should throw error for invalid API response format', async () => {
      const mockIssue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-123',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              user: {
                projectV2: {
                  id: 'proj-123',
                  fields: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        id: 'field-1',
                        name: 'Status',
                        options: [{ id: 'opt-2', name: 'Preparation' }],
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
          json: async () => null,
        });

      await expect(
        repository.update(mockIssue, createMockProject()),
      ).rejects.toThrow('Invalid API response format');
    });

    it('should handle organization projects', async () => {
      const mockIssue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-123',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              organization: {
                projectV2: {
                  id: 'proj-123',
                  fields: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        id: 'field-1',
                        name: 'Status',
                        options: [{ id: 'opt-2', name: 'Preparation' }],
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
              updateProjectV2ItemFieldValue: {
                projectV2Item: { id: 'item-123' },
              },
            },
          }),
        });

      const orgProject = {
        ...createMockProject(),
        url: 'https://github.com/orgs/myorg/projects/1',
      };

      await repository.update(mockIssue, orgProject);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle pagination when searching for status field', async () => {
      const mockIssue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-123',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              user: {
                projectV2: {
                  id: 'proj-123',
                  fields: {
                    pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
                    nodes: [{ id: 'field-other', name: 'Other' }],
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
              user: {
                projectV2: {
                  id: 'proj-123',
                  fields: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        id: 'field-1',
                        name: 'Status',
                        options: [{ id: 'opt-2', name: 'Preparation' }],
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
              updateProjectV2ItemFieldValue: {
                projectV2Item: { id: 'item-123' },
              },
            },
          }),
        });

      await repository.update(mockIssue, createMockProject());

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should return null when projectData is not found in response', async () => {
      const mockIssue = createMockIssue({ status: 'Preparation' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {},
        }),
      });

      await expect(
        repository.update(mockIssue, createMockProject()),
      ).rejects.toThrow('Status option not found for status: Preparation');
    });

    it('should return null when response is not valid StatusFieldsResponse', async () => {
      const mockIssue = createMockIssue({ status: 'Preparation' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'not an object',
      });

      await expect(
        repository.update(mockIssue, createMockProject()),
      ).rejects.toThrow('Status option not found for status: Preparation');
    });
  });

  describe('findRelatedOpenPRs', () => {
    it('should return related open PRs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      willCloseTarget: true,
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: { state: 'SUCCESS' },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://github.com/user/repo/pull/1');
      expect(result[0].isPassedAllCiJob).toBe(true);
      expect(result[0].isConflicted).toBe(false);
      expect(result[0].isResolvedAllReviewComments).toBe(true);
      expect(result[0].isBranchOutOfDate).toBe(false);
    });

    it('should handle conflicted PRs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'CONFLICTING',
                        commits: { nodes: [] },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result[0].isConflicted).toBe(true);
      // Note: isBranchOutOfDate is always false as compareWithBaseRef is not available in timeline items
      expect(result[0].isBranchOutOfDate).toBe(false);
    });

    it('should treat UNKNOWN mergeable state as conflicted', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'UNKNOWN',
                        commits: { nodes: [] },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result[0].isConflicted).toBe(true);
    });

    it('should handle unresolved review comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        commits: { nodes: [] },
                        reviewThreads: {
                          nodes: [{ isResolved: false }, { isResolved: true }],
                        },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result[0].isResolvedAllReviewComments).toBe(false);
    });

    it('should filter out closed PRs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        state: 'CLOSED',
                      },
                    },
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/2',
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        commits: { nodes: [] },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://github.com/user/repo/pull/2');
    });

    it('should handle pagination', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                issue: {
                  timelineItems: {
                    pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
                    nodes: [
                      {
                        __typename: 'CrossReferencedEvent',
                        source: {
                          __typename: 'PullRequest',
                          url: 'https://github.com/user/repo/pull/1',
                          state: 'OPEN',
                          mergeable: 'MERGEABLE',
                          commits: { nodes: [] },
                          reviewThreads: { nodes: [] },
                          baseRef: { name: 'main' },
                        },
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
                  timelineItems: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        __typename: 'CrossReferencedEvent',
                        source: {
                          __typename: 'PullRequest',
                          url: 'https://github.com/user/repo/pull/2',
                          state: 'OPEN',
                          mergeable: 'MERGEABLE',
                          commits: { nodes: [] },
                          reviewThreads: { nodes: [] },
                          baseRef: { name: 'main' },
                        },
                      },
                    ],
                  },
                },
              },
            },
          }),
        });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error for invalid issue URL', async () => {
      await expect(
        repository.findRelatedOpenPRs('invalid-url'),
      ).rejects.toThrow('Invalid GitHub issue URL');
    });

    it('should throw error when called with a pull request URL', async () => {
      await expect(
        repository.findRelatedOpenPRs('https://github.com/user/repo/pull/5'),
      ).rejects.toThrow(
        'findRelatedOpenPRs only supports issue URLs, not pull request URLs',
      );
    });

    it('should throw error when API response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        repository.findRelatedOpenPRs('https://github.com/user/repo/issues/1'),
      ).rejects.toThrow(
        'Failed to fetch issue timeline from GitHub GraphQL API',
      );
    });

    it('should throw error when issue is not found', async () => {
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
        repository.findRelatedOpenPRs('https://github.com/user/repo/issues/1'),
      ).rejects.toThrow(
        'Issue not found when fetching timeline from GitHub GraphQL API',
      );
    });

    it('should skip non-CrossReferencedEvent items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    { __typename: 'IssueComment' },
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        commits: { nodes: [] },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
    });

    it('should skip non-PullRequest sources', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: { __typename: 'Issue' },
                    },
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        commits: { nodes: [] },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
    });

    it('should handle missing source', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: null,
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(0);
    });

    it('should throw error when response is not valid IssueTimelineResponse', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'not an object',
      });

      await expect(
        repository.findRelatedOpenPRs('https://github.com/user/repo/issues/1'),
      ).rejects.toThrow(
        'Unexpected response shape when fetching issue timeline from GitHub GraphQL API',
      );
    });

    it('should handle PR with missing optional fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: undefined,
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        commits: null,
                        reviewThreads: null,
                        baseRef: null,
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('');
      expect(result[0].isPassedAllCiJob).toBe(false);
      expect(result[0].isResolvedAllReviewComments).toBe(true);
      expect(result[0].isBranchOutOfDate).toBe(false);
    });

    it('should handle PR with empty commits nodes array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        commits: { nodes: [] },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should handle PR with commit but no statusCheckRollup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: null,
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should handle PR with FAILURE CI state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: { state: 'FAILURE' },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should return isPassedAllCiJob as false when ciState is SUCCESS but required checks have not run', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: [
                                  'Check linked issues in pull requests',
                                  'create_and_enable_automerge',
                                ],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'commit-lint',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should return isPassedAllCiJob as true when all required checks passed but blocked by required review', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['test', 'format'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                      {
                                        __typename: 'CheckRun',
                                        name: 'format',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should return isPassedAllCiJob as true when ciState is SUCCESS and no branch protection rules exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should return isPassedAllCiJob as true when required check has SKIPPED conclusion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['test', 'lint'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                      {
                                        __typename: 'CheckRun',
                                        name: 'lint',
                                        conclusion: 'SKIPPED',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should return isPassedAllCiJob as true with StatusContext type checks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['ci/build'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'StatusContext',
                                        context: 'ci/build',
                                        state: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should match branch protection rule with glob pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'release/v1.0',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'release/*',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'release/v1.0' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should match branch protection rule with ** glob pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'qa/foo/bar',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'qa/**/*',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'qa/foo/bar' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should match branch protection rule with ** at end of pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'feature/deep/nested',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'feature/**',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'feature/deep/nested' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should match branch protection rule with ? glob pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'releases/v1.0',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'releases/v?.?',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'releases/v1.0' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should match branch protection rule with character class [1-9] glob pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: '1-0-stable',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: '[1-9]-[0-9]-stable',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: '1-0-stable' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should match branch protection rule with negated character class [!a] glob pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'xain',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: '[!m]ain',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'xain' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should collect union of required checks from multiple matching branch protection rules', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['test'],
                              },
                              {
                                pattern: '*',
                                requiredStatusCheckContexts: ['lint'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should return isPassedAllCiJob as true when baseRefName and baseRef are both missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: null,
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should treat unclosed character class [ as literal in branch protection pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: '[unclosed',
                                requiredStatusCheckContexts: ['test'],
                              },
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should handle special regex characters in character class patterns', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should fallback to literal match when branch protection pattern produces invalid regex', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: '[z-a]ain',
                                requiredStatusCheckContexts: ['test'],
                              },
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['test'],
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should detect required checks from rulesets with ~DEFAULT_BRANCH condition', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'CI checks',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~DEFAULT_BRANCH'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'ci (20)' },
                                          { context: 'wip-check' },
                                          { context: 'merge-reports' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'ci (20)',
                                        conclusion: 'SUCCESS',
                                      },
                                      {
                                        __typename: 'CheckRun',
                                        name: 'wip-check',
                                        conclusion: 'SUCCESS',
                                      },
                                      {
                                        __typename: 'CheckRun',
                                        name: 'merge-reports',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should return isPassedAllCiJob as false when required checks from rulesets are not passing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'CI checks',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~DEFAULT_BRANCH'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'ci (20)' },
                                          { context: 'wip-check' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'ci (20)',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should skip rulesets with non-ACTIVE enforcement', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'Disabled checks',
                                enforcement: 'DISABLED',
                                conditions: {
                                  refName: {
                                    include: ['~DEFAULT_BRANCH'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'should-not-be-required' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: { nodes: [] },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should skip rulesets that do not match the PR base branch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'develop',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'Main branch checks',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~DEFAULT_BRANCH'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'test' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: { nodes: [] },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'develop' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should match rulesets with refs/heads/ prefix pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'staging',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'Staging checks',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['refs/heads/staging'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'deploy-check' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'deploy-check',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'staging' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should exclude rulesets matching exclude pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'All except main',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~ALL'],
                                    exclude: ['~DEFAULT_BRANCH'],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'should-not-apply' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: { nodes: [] },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should merge required checks from both branch protection rules and rulesets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: {
                            nodes: [
                              {
                                pattern: 'main',
                                requiredStatusCheckContexts: ['legacy-test'],
                              },
                            ],
                          },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'CI checks',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~DEFAULT_BRANCH'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'ruleset-test' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'legacy-test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should match rulesets with ~ALL include pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'any-branch',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'All branches',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~ALL'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'universal-check' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'universal-check',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'any-branch' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should skip non-REQUIRED_STATUS_CHECKS rules in rulesets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'Mixed rules',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~DEFAULT_BRANCH'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'PULL_REQUEST',
                                      parameters: {},
                                    },
                                    {
                                      type: 'REQUIRED_LINEAR_HISTORY',
                                      parameters: {},
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: { nodes: [] },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should handle rulesets with refs/heads/ exclude pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'staging',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'All except staging',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~ALL'],
                                    exclude: ['refs/heads/staging'],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'excluded-check' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: { nodes: [] },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'staging' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should match rulesets with glob pattern in include', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'release/v2.0',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'Release checks',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['refs/heads/release/*'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'release-test' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: {
                                    nodes: [
                                      {
                                        __typename: 'CheckRun',
                                        name: 'release-test',
                                        conclusion: 'SUCCESS',
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'release/v2.0' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should exclude rulesets matching glob pattern in exclude', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'hotfix/urgent',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'All except hotfix',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~ALL'],
                                    exclude: ['refs/heads/hotfix/*'],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {
                                        requiredStatusChecks: [
                                          { context: 'should-not-apply' },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: { nodes: [] },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'hotfix/urgent' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should handle rulesets with empty parameters in REQUIRED_STATUS_CHECKS rule', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                          defaultBranchRef: { name: 'main' },
                          rulesets: {
                            nodes: [
                              {
                                name: 'Empty params ruleset',
                                enforcement: 'ACTIVE',
                                conditions: {
                                  refName: {
                                    include: ['~DEFAULT_BRANCH'],
                                    exclude: [],
                                  },
                                },
                                rules: {
                                  nodes: [
                                    {
                                      type: 'REQUIRED_STATUS_CHECKS',
                                      parameters: {},
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: { nodes: [] },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('should handle PR with no rulesets in baseRepository', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/user/repo/pull/1',
                        number: 1,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        baseRepository: {
                          branchProtectionRules: { nodes: [] },
                        },
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                  contexts: { nodes: [] },
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: { nodes: [] },
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/user/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });
  });

  describe('get', () => {
    it('should return issue data from GitHub GraphQL API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                number: 1,
                title: 'Test Issue',
                state: 'OPEN',
                body: 'Test body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/issues/1',
                assignees: { nodes: [{ login: 'user1' }] },
                labels: { nodes: [{ name: 'bug' }] },
                projectItems: {
                  nodes: [
                    {
                      id: 'item-123',
                      project: { number: 1 },
                      fieldValueByName: { name: 'Preparation' },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.number).toBe(1);
      expect(result?.title).toBe('Test Issue');
      expect(result?.state).toBe('OPEN');
      expect(result?.status).toBe('Preparation');
      expect(result?.itemId).toBe('item-123');
      expect(result?.assignees).toEqual(['user1']);
      expect(result?.labels).toEqual(['bug']);
    });

    it('should return null when issue is not found', async () => {
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

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).toBeNull();
    });

    it('should throw error when API response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        repository.get(
          'https://github.com/user/repo/issues/1',
          createMockProject(),
        ),
      ).rejects.toThrow('Failed to fetch issue from GitHub GraphQL API');
    });

    it('should handle issue not in any project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                number: 1,
                title: 'Test Issue',
                state: 'OPEN',
                body: 'Test body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/issues/1',
                assignees: { nodes: [] },
                labels: { nodes: [] },
                projectItems: { nodes: [] },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBeNull();
      expect(result?.itemId).toBe('');
    });

    it('should handle issue in different project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                number: 1,
                title: 'Test Issue',
                state: 'OPEN',
                body: 'Test body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/issues/1',
                assignees: { nodes: [] },
                labels: { nodes: [] },
                projectItems: {
                  nodes: [
                    {
                      id: 'item-456',
                      project: { number: 99 },
                      fieldValueByName: { name: 'Other Status' },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBeNull();
      expect(result?.itemId).toBe('');
    });

    it('should throw error for invalid issue URL', async () => {
      await expect(
        repository.get('invalid-url', createMockProject()),
      ).rejects.toThrow('Invalid GitHub issue URL');
    });

    it('should throw error for invalid API response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'not an object',
      });

      await expect(
        repository.get(
          'https://github.com/user/repo/issues/1',
          createMockProject(),
        ),
      ).rejects.toThrow('Unexpected response shape when fetching issue');
    });

    it('should handle closed issue', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                number: 1,
                title: 'Closed Issue',
                state: 'CLOSED',
                body: 'Test body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/issues/1',
                assignees: { nodes: [] },
                labels: { nodes: [] },
                projectItems: { nodes: [] },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.isClosed).toBe(true);
      expect(result?.state).toBe('CLOSED');
    });

    it('should handle fieldValueByName being null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                number: 1,
                title: 'Test Issue',
                state: 'OPEN',
                body: 'Test body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/issues/1',
                assignees: { nodes: [] },
                labels: { nodes: [] },
                projectItems: {
                  nodes: [
                    {
                      id: 'item-123',
                      project: { number: 1 },
                      fieldValueByName: null,
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBeNull();
      expect(result?.itemId).toBe('item-123');
    });

    it('should handle MERGED state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                number: 1,
                title: 'Merged PR',
                state: 'MERGED',
                body: 'Test body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/issues/1',
                assignees: { nodes: [] },
                labels: { nodes: [] },
                projectItems: { nodes: [] },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.state).toBe('MERGED');
    });

    it('should return PR data from GitHub GraphQL API when URL is a pull request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              pullRequest: {
                number: 5,
                title: 'Test PR',
                state: 'OPEN',
                body: 'PR body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/pull/5',
                assignees: { nodes: [{ login: 'user1' }] },
                labels: { nodes: [{ name: 'enhancement' }] },
                projectItems: {
                  nodes: [
                    {
                      id: 'item-456',
                      project: { number: 1 },
                      fieldValueByName: { name: 'Preparation' },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/pull/5',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.number).toBe(5);
      expect(result?.title).toBe('Test PR');
      expect(result?.state).toBe('OPEN');
      expect(result?.status).toBe('Preparation');
      expect(result?.itemId).toBe('item-456');
      expect(result?.isPr).toBe(true);
      expect(result?.assignees).toEqual(['user1']);
      expect(result?.labels).toEqual(['enhancement']);
    });

    it('should return null when PR is not found', async () => {
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

      const result = await repository.get(
        'https://github.com/user/repo/pull/999',
        createMockProject(),
      );

      expect(result).toBeNull();
    });

    it('should handle MERGED state for PR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              pullRequest: {
                number: 5,
                title: 'Merged PR',
                state: 'MERGED',
                body: 'PR body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/pull/5',
                assignees: { nodes: [] },
                labels: { nodes: [] },
                projectItems: { nodes: [] },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/pull/5',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.state).toBe('MERGED');
      expect(result?.isPr).toBe(true);
    });

    it('should default to OPEN state for unknown states', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issue: {
                number: 1,
                title: 'Unknown State',
                state: 'UNKNOWN_STATE',
                body: 'Test body',
                createdAt: '2024-01-01T00:00:00Z',
                url: 'https://github.com/user/repo/issues/1',
                assignees: { nodes: [] },
                labels: { nodes: [] },
                projectItems: { nodes: [] },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.state).toBe('OPEN');
    });
  });
});
