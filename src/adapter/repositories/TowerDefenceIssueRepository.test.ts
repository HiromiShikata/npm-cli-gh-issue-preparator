import { TowerDefenceIssueRepository } from './TowerDefenceIssueRepository';
import {
  getStoryObjectMap,
  Issue,
  Project as TowerDefenceProject,
  StoryObjectMap,
} from 'github-issue-tower-defence-management';
import { Project } from '../../domain/entities/Project';

jest.mock('github-issue-tower-defence-management', () => ({
  getStoryObjectMap: jest.fn(),
}));

const mockedGetStoryObjectMap = jest.mocked(getStoryObjectMap);

const createMockTowerDefenceProject = (): TowerDefenceProject => ({
  id: 'proj-1',
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

const createMockStoryObjectMap = (): StoryObjectMap => new Map();

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
  ...overrides,
});

describe('TowerDefenceIssueRepository', () => {
  let repository: TowerDefenceIssueRepository;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    repository = new TowerDefenceIssueRepository(
      '/path/to/config.yml',
      'test-token',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAllOpened', () => {
    it('should return only open issues', async () => {
      const mockIssues: Issue[] = [
        createMockIssue({
          url: 'https://github.com/user/repo/issues/1',
          state: 'OPEN',
        }),
        createMockIssue({
          url: 'https://github.com/user/repo/issues/2',
          state: 'CLOSED',
        }),
        createMockIssue({
          url: 'https://github.com/user/repo/issues/3',
          state: 'OPEN',
        }),
      ];

      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: mockIssues,
        cacheUsed: false,
        storyObjectMap: createMockStoryObjectMap(),
      });

      const result = await repository.getAllOpened(createMockProject());

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://github.com/user/repo/issues/1');
      expect(result[1].url).toBe('https://github.com/user/repo/issues/3');
    });

    it('should use cached data on subsequent calls', async () => {
      const mockIssues: Issue[] = [createMockIssue({ state: 'OPEN' })];

      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: mockIssues,
        cacheUsed: false,
        storyObjectMap: createMockStoryObjectMap(),
      });

      await repository.getAllOpened(createMockProject());
      await repository.getAllOpened(createMockProject());

      expect(getStoryObjectMap).toHaveBeenCalledTimes(1);
    });
  });

  describe('get', () => {
    it('should return issue by URL', async () => {
      const mockIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
      });

      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: [mockIssue],
        cacheUsed: false,
        storyObjectMap: createMockStoryObjectMap(),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/1',
        createMockProject(),
      );

      expect(result).toBeDefined();
      expect(result?.url).toBe('https://github.com/user/repo/issues/1');
    });

    it('should return null for non-existent issue', async () => {
      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: [],
        cacheUsed: false,
        storyObjectMap: createMockStoryObjectMap(),
      });

      const result = await repository.get(
        'https://github.com/user/repo/issues/999',
        createMockProject(),
      );

      expect(result).toBeNull();
    });
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
                        headRefName: 'feature',
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
                        compareWithBaseRef: { behindBy: 0 },
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
                        compareWithBaseRef: { behindBy: 5 },
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
      expect(result[0].isBranchOutOfDate).toBe(true);
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
                        compareWithBaseRef: { behindBy: 0 },
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
                        compareWithBaseRef: { behindBy: 0 },
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
                          compareWithBaseRef: { behindBy: 0 },
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
                          compareWithBaseRef: { behindBy: 0 },
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
                        compareWithBaseRef: { behindBy: 0 },
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
                        compareWithBaseRef: { behindBy: 0 },
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
                        compareWithBaseRef: null,
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
                        compareWithBaseRef: { behindBy: 0 },
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
                        compareWithBaseRef: { behindBy: 0 },
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
                        compareWithBaseRef: { behindBy: 0 },
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
  });
});
