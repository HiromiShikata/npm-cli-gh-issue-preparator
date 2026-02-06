import { GitHubIssueRepository } from './GitHubIssueRepository';
import { Project } from '../../domain/entities/Project';
import { Issue } from '../../domain/entities/Issue';

describe('GitHubIssueRepository', () => {
  let repository: GitHubIssueRepository;
  let mockFetch: jest.Mock;

  const mockProject: Project = {
    id: '123',
    url: 'https://github.com/orgs/test-org/projects/123',
    name: 'Test Project',
    statuses: ['Awaiting Workspace', 'Preparation', 'Done'],
    customFieldNames: ['Status', 'workspace'],
    statusFieldId: 'status-field-id',
  };

  const mockUserProject: Project = {
    id: 'user-123',
    url: 'https://github.com/users/testuser/projects/456',
    name: 'User Project',
    statuses: ['Todo', 'Done'],
    customFieldNames: ['Status'],
    statusFieldId: 'status-field-id-user',
  };

  beforeEach(() => {
    repository = new GitHubIssueRepository('test-token');
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    jest.clearAllMocks();
  });

  describe('getAllOpened', () => {
    it('should fetch all opened issues from project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 2,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-1',
                      content: {
                        url: 'https://github.com/owner/repo/issues/1',
                        title: 'Test Issue 1',
                        number: 1,
                        labels: {
                          nodes: [{ name: 'bug' }, { name: 'category:impl' }],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Awaiting Workspace',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                    {
                      id: 'issue-2',
                      content: {
                        url: 'https://github.com/owner/repo/issues/2',
                        title: 'Test Issue 2',
                        number: 2,
                        labels: {
                          nodes: [{ name: 'enhancement' }],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Preparation',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const issues = await repository.getAllOpened(mockProject);

      expect(issues).toHaveLength(2);
      expect(issues[0]).toEqual({
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue 1',
        labels: ['bug', 'category:impl'],
        status: 'Awaiting Workspace',
        comments: [],
      });
      expect(issues[1]).toEqual({
        id: 'issue-2',
        url: 'https://github.com/owner/repo/issues/2',
        title: 'Test Issue 2',
        labels: ['enhancement'],
        status: 'Preparation',
        comments: [],
      });
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('API Error'),
      });

      await expect(repository.getAllOpened(mockProject)).rejects.toThrow(
        'GitHub API error',
      );
    });

    it('should throw error when response format is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(repository.getAllOpened(mockProject)).rejects.toThrow(
        'Invalid API response format',
      );
    });

    it('should handle invalid project URL', async () => {
      const invalidProject: Project = {
        ...mockProject,
        url: 'https://invalid-url',
      };

      await expect(repository.getAllOpened(invalidProject)).rejects.toThrow(
        'Invalid GitHub project URL',
      );
    });

    it('should fetch issues from user project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            user: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'user-issue-1',
                      content: {
                        url: 'https://github.com/owner/repo/issues/10',
                        title: 'User Issue',
                        number: 10,
                        labels: {
                          nodes: [{ name: 'enhancement' }],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Todo',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const issues = await repository.getAllOpened(mockUserProject);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        id: 'user-issue-1',
        url: 'https://github.com/owner/repo/issues/10',
        title: 'User Issue',
        labels: ['enhancement'],
        status: 'Todo',
        comments: [],
      });
    });

    it('should skip items without content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 2,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'item-without-content',
                      content: null,
                    },
                    {
                      id: 'valid-issue',
                      content: {
                        url: 'https://github.com/owner/repo/issues/5',
                        title: 'Valid Issue',
                        number: 5,
                        labels: {
                          nodes: [],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Done',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const issues = await repository.getAllOpened(mockProject);

      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('valid-issue');
    });

    it('should return empty array when both organization and user projects are null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: null,
            user: null,
          },
        }),
      });

      const issues = await repository.getAllOpened(mockProject);

      expect(issues).toEqual([]);
    });

    it('should skip items with content but undefined url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 2,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'item-with-undefined-url',
                      content: {
                        url: undefined,
                        title: 'Item Without URL',
                        number: 1,
                        labels: {
                          nodes: [],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Done',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                    {
                      id: 'valid-issue',
                      content: {
                        url: 'https://github.com/owner/repo/issues/5',
                        title: 'Valid Issue',
                        number: 5,
                        labels: {
                          nodes: [],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Done',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const issues = await repository.getAllOpened(mockProject);

      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('valid-issue');
    });

    it('should handle items with null labels nodes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-no-labels',
                      content: {
                        url: 'https://github.com/owner/repo/issues/10',
                        title: 'Issue Without Labels',
                        number: 10,
                        labels: null,
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Done',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const issues = await repository.getAllOpened(mockProject);

      expect(issues).toHaveLength(1);
      expect(issues[0].labels).toEqual([]);
    });

    it('should handle issue without Status field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-no-status',
                      content: {
                        url: 'https://github.com/owner/repo/issues/99',
                        title: 'Issue Without Status',
                        number: 99,
                        labels: {
                          nodes: [{ name: 'bug' }],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Some Value',
                            field: {
                              name: 'OtherField',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const issues = await repository.getAllOpened(mockProject);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        id: 'issue-no-status',
        url: 'https://github.com/owner/repo/issues/99',
        title: 'Issue Without Status',
        labels: ['bug'],
        status: '',
        comments: [],
      });
    });
  });

  describe('update', () => {
    it('should update issue status', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                fields: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'Status',
                      options: [{ id: 'status-1', name: 'Preparation' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            updateProjectV2ItemFieldValue: {
              projectV2Item: {
                id: 'issue-1',
              },
            },
          },
        }),
      });

      await repository.update(issue, mockProject);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should update issue status to Done', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Done',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                fields: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'Status',
                      options: [{ id: 'status-2', name: 'Done' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            updateProjectV2ItemFieldValue: {
              projectV2Item: {
                id: 'issue-1',
              },
            },
          },
        }),
      });

      await repository.update(issue, mockProject);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should throw error when status option not found', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'NonExistentStatus',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                fields: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'Status',
                      options: [{ id: 'status-1', name: 'Preparation' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      await expect(repository.update(issue, mockProject)).rejects.toThrow(
        'Status option not found for status: NonExistentStatus',
      );
    });

    it('should throw error when getStatusOptionId response is not ok', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      await expect(repository.update(issue, mockProject)).rejects.toThrow(
        'Status option not found',
      );
    });

    it('should throw error when getStatusOptionId response is invalid', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(repository.update(issue, mockProject)).rejects.toThrow(
        'Status option not found',
      );
    });

    it('should throw error when status field not found', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                fields: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'NotStatus',
                      options: [{ id: 'status-1', name: 'Preparation' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      await expect(repository.update(issue, mockProject)).rejects.toThrow(
        'Status option not found',
      );
    });

    it('should throw error when update mutation fails', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                fields: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'Status',
                      options: [{ id: 'status-1', name: 'Preparation' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'API Error' }),
      });

      await expect(repository.update(issue, mockProject)).rejects.toThrow(
        'GitHub API error',
      );
    });

    it('should throw error when update response has GraphQL errors', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                fields: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'Status',
                      options: [{ id: 'status-1', name: 'Preparation' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          errors: [{ message: 'GraphQL Error' }],
        }),
      });

      await expect(repository.update(issue, mockProject)).rejects.toThrow(
        'GraphQL errors',
      );
    });

    it('should throw error when update response format is invalid', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                fields: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'Status',
                      options: [{ id: 'status-1', name: 'Preparation' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(repository.update(issue, mockProject)).rejects.toThrow(
        'Invalid API response format',
      );
    });

    it('should update issue status for user project', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Todo',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            user: {
              projectV2: {
                fields: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: 'field-1',
                      name: 'Status',
                      options: [{ id: 'status-1', name: 'Todo' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            updateProjectV2ItemFieldValue: {
              projectV2Item: {
                id: 'issue-1',
              },
            },
          },
        }),
      });

      await repository.update(issue, mockUserProject);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error when both organization and user projects are null in getStatusOptionId', async () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: null,
            user: null,
          },
        }),
      });

      await expect(repository.update(issue, mockProject)).rejects.toThrow(
        'Status option not found',
      );
    });
  });

  describe('get', () => {
    it('should return issue when found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-1',
                      content: {
                        url: 'https://github.com/owner/repo/issues/1',
                        title: 'Test Issue',
                        number: 1,
                        labels: {
                          nodes: [{ name: 'bug' }],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Preparation',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/1',
        mockProject,
      );

      expect(result).toEqual({
        id: 'issue-1',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Test Issue',
        labels: ['bug'],
        status: 'Preparation',
        comments: [],
      });
    });

    it('should return null when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/1',
        mockProject,
      );
      expect(result).toBeNull();
    });

    it('should return null when response format is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/1',
        mockProject,
      );
      expect(result).toBeNull();
    });

    it('should return null when issue not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 0,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/999',
        mockProject,
      );
      expect(result).toBeNull();
    });

    it('should return issue from user project when found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            user: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-2',
                      content: {
                        url: 'https://github.com/owner/repo/issues/2',
                        title: 'User Issue',
                        number: 2,
                        labels: {
                          nodes: [{ name: 'feature' }],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Todo',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/2',
        mockUserProject,
      );

      expect(result).toEqual({
        id: 'issue-2',
        url: 'https://github.com/owner/repo/issues/2',
        title: 'User Issue',
        labels: ['feature'],
        status: 'Todo',
        comments: [],
      });
    });

    it('should return issue with empty status when status field not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-3',
                      content: {
                        url: 'https://github.com/owner/repo/issues/3',
                        title: 'Issue Without Status',
                        number: 3,
                        labels: {
                          nodes: [],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            text: 'Some text',
                            field: {
                              name: 'Description',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/3',
        mockProject,
      );

      expect(result).toEqual({
        id: 'issue-3',
        url: 'https://github.com/owner/repo/issues/3',
        title: 'Issue Without Status',
        labels: [],
        status: '',
        comments: [],
      });
    });

    it('should skip items without content in get method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  nodes: [
                    {
                      id: 'item-without-content',
                      content: null,
                    },
                    {
                      id: 'target-issue',
                      content: {
                        url: 'https://github.com/owner/repo/issues/4',
                        title: 'Target Issue',
                        number: 4,
                        labels: {
                          nodes: [],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Done',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/4',
        mockProject,
      );

      expect(result?.id).toBe('target-issue');
    });

    it('should return null when both organization and user projects are null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: null,
            user: null,
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/1',
        mockProject,
      );

      expect(result).toBeNull();
    });

    it('should handle issue with null labels in get method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-null-labels',
                      content: {
                        url: 'https://github.com/owner/repo/issues/1',
                        title: 'Issue With Null Labels',
                        number: 1,
                        labels: null,
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Done',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/1',
        mockProject,
      );

      expect(result).toEqual({
        id: 'issue-null-labels',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Issue With Null Labels',
        labels: [],
        status: 'Done',
        comments: [],
      });
    });

    it('should fetch and map comments correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-with-comments',
                      content: {
                        url: 'https://github.com/owner/repo/issues/1',
                        title: 'Issue With Comments',
                        number: 1,
                        labels: {
                          nodes: [],
                        },
                        comments: {
                          nodes: [
                            {
                              author: {
                                login: 'user1',
                              },
                              body: 'First comment',
                              createdAt: '2024-01-15T10:00:00Z',
                            },
                            {
                              author: {
                                login: 'user2',
                              },
                              body: 'Second comment',
                              createdAt: '2024-01-16T12:00:00Z',
                            },
                          ],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Todo',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/1',
        mockProject,
      );

      expect(result).toEqual({
        id: 'issue-with-comments',
        url: 'https://github.com/owner/repo/issues/1',
        title: 'Issue With Comments',
        labels: [],
        status: 'Todo',
        comments: [
          {
            author: 'user1',
            content: 'First comment',
            createdAt: new Date('2024-01-15T10:00:00Z'),
          },
          {
            author: 'user2',
            content: 'Second comment',
            createdAt: new Date('2024-01-16T12:00:00Z'),
          },
        ],
      });
    });

    it('should handle comments with null author', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                items: {
                  totalCount: 1,
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      id: 'issue-null-author',
                      content: {
                        url: 'https://github.com/owner/repo/issues/1',
                        title: 'Issue With Null Author Comment',
                        number: 1,
                        labels: {
                          nodes: [],
                        },
                        comments: {
                          nodes: [
                            {
                              author: null,
                              body: 'Comment from deleted user',
                              createdAt: '2024-01-15T10:00:00Z',
                            },
                          ],
                        },
                      },
                      fieldValues: {
                        nodes: [
                          {
                            name: 'Todo',
                            field: {
                              name: 'Status',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.get(
        'https://github.com/owner/repo/issues/1',
        mockProject,
      );

      expect(result?.comments).toEqual([
        {
          author: '',
          content: 'Comment from deleted user',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
      ]);
    });
  });

  describe('findRelatedOpenPRs', () => {
    it('should find related open PRs for an issue', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      willCloseTarget: true,
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [{ isResolved: true }],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        url: 'https://github.com/owner/repo/pull/10',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      });
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        repository.findRelatedOpenPRs('https://github.com/owner/repo/issues/1'),
      ).rejects.toThrow(
        'Failed to fetch issue timeline from GitHub GraphQL API: 500 Internal Server Error',
      );
    });

    it('should throw error when response format is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(
        repository.findRelatedOpenPRs('https://github.com/owner/repo/issues/1'),
      ).rejects.toThrow(
        'Unexpected response shape when fetching issue timeline from GitHub GraphQL API.',
      );
    });

    it('should throw error when issue data is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: null,
            },
          },
        }),
      });

      await expect(
        repository.findRelatedOpenPRs('https://github.com/owner/repo/issues/1'),
      ).rejects.toThrow(
        'Issue not found when fetching timeline from GitHub GraphQL API.',
      );
    });

    it('should throw error for invalid issue URL', async () => {
      await expect(
        repository.findRelatedOpenPRs('https://invalid-url'),
      ).rejects.toThrow('Invalid GitHub issue URL');
    });

    it('should detect conflicting PR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'CONFLICTING',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isConflicted).toBe(true);
    });

    it('should detect failing CI', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'FAILURE',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should detect unresolved review comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [{ isResolved: true }, { isResolved: false }],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isResolvedAllReviewComments).toBe(false);
    });

    it('should detect branch out of date', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
                        compareWithBaseRef: {
                          behindBy: 5,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isBranchOutOfDate).toBe(true);
    });

    it('should skip closed PRs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'CLOSED',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(0);
    });

    it('should skip non-CrossReferencedEvent items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'LabeledEvent',
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(0);
    });

    it('should skip items without PullRequest source', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'Issue',
                        url: 'https://github.com/owner/repo/issues/5',
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(0);
    });

    it('should handle PR with null statusCheckRollup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: null,
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isPassedAllCiJob).toBe(false);
    });

    it('should handle PR with empty reviewThreads', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isResolvedAllReviewComments).toBe(true);
    });

    it('should handle pagination', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            data: {
              repository: {
                issue: {
                  timelineItems: {
                    pageInfo: {
                      endCursor: 'cursor1',
                      hasNextPage: true,
                    },
                    nodes: [
                      {
                        __typename: 'CrossReferencedEvent',
                        source: {
                          __typename: 'PullRequest',
                          url: 'https://github.com/owner/repo/pull/10',
                          number: 10,
                          state: 'OPEN',
                          mergeable: 'MERGEABLE',
                          baseRefName: 'main',
                          headRefName: 'feature-branch',
                          commits: {
                            nodes: [
                              {
                                commit: {
                                  statusCheckRollup: {
                                    state: 'SUCCESS',
                                  },
                                },
                              },
                            ],
                          },
                          reviewThreads: {
                            nodes: [],
                          },
                          compareWithBaseRef: {
                            behindBy: 0,
                          },
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
          json: jest.fn().mockResolvedValue({
            data: {
              repository: {
                issue: {
                  timelineItems: {
                    pageInfo: {
                      endCursor: null,
                      hasNextPage: false,
                    },
                    nodes: [
                      {
                        __typename: 'CrossReferencedEvent',
                        source: {
                          __typename: 'PullRequest',
                          url: 'https://github.com/owner/repo/pull/11',
                          number: 11,
                          state: 'OPEN',
                          mergeable: 'MERGEABLE',
                          baseRefName: 'main',
                          headRefName: 'another-branch',
                          commits: {
                            nodes: [
                              {
                                commit: {
                                  statusCheckRollup: {
                                    state: 'SUCCESS',
                                  },
                                },
                              },
                            ],
                          },
                          reviewThreads: {
                            nodes: [],
                          },
                          compareWithBaseRef: {
                            behindBy: 5,
                          },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://github.com/owner/repo/pull/10');
      expect(result[1].url).toBe('https://github.com/owner/repo/pull/11');
    });

    it('should handle CrossReferencedEvent without source', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(0);
    });

    it('should handle PR without compareWithBaseRef data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isBranchOutOfDate).toBe(false);
    });

    it('should handle PR with undefined url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: undefined,
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('');
    });

    it('should handle PR with undefined reviewThreads nodes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: null,
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isResolvedAllReviewComments).toBe(true);
    });

    it('should deduplicate PRs when same PR is cross-referenced multiple times', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                  },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'MERGEABLE',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'SUCCESS',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [],
                        },
                        compareWithBaseRef: {
                          behindBy: 0,
                        },
                      },
                    },
                    {
                      __typename: 'CrossReferencedEvent',
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/owner/repo/pull/10',
                        number: 10,
                        state: 'OPEN',
                        mergeable: 'CONFLICTING',
                        baseRefName: 'main',
                        headRefName: 'feature-branch',
                        commits: {
                          nodes: [
                            {
                              commit: {
                                statusCheckRollup: {
                                  state: 'FAILURE',
                                },
                              },
                            },
                          ],
                        },
                        reviewThreads: {
                          nodes: [{ isResolved: false }],
                        },
                        compareWithBaseRef: {
                          behindBy: 5,
                        },
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
        'https://github.com/owner/repo/issues/1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://github.com/owner/repo/pull/10');
      expect(result[0].isConflicted).toBe(true);
      expect(result[0].isPassedAllCiJob).toBe(false);
      expect(result[0].isResolvedAllReviewComments).toBe(false);
      expect(result[0].isBranchOutOfDate).toBe(true);
    });
  });
});
