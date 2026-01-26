import { GitHubProjectRepository } from './GitHubProjectRepository';

describe('GitHubProjectRepository', () => {
  let repository: GitHubProjectRepository;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    repository = new GitHubProjectRepository('test-token');
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    jest.clearAllMocks();
  });

  describe('getByUrl', () => {
    it('should fetch project data from GitHub API', async () => {
      const projectUrl = 'https://github.com/orgs/test-org/projects/1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            organization: {
              projectV2: {
                id: 'project-id',
                title: 'Test Project',
                url: projectUrl,
                fields: {
                  nodes: [
                    {
                      id: 'status-field-id',
                      name: 'Status',
                      options: [
                        { name: 'Awaiting workspace' },
                        { name: 'Preparation' },
                        { name: 'Done' },
                      ],
                    },
                    { id: 'workspace-field-id', name: 'workspace' },
                  ],
                },
              },
            },
          },
        }),
      });

      const project = await repository.getByUrl(projectUrl);

      expect(project).toEqual({
        id: 'project-id',
        url: projectUrl,
        name: 'Test Project',
        statuses: ['Awaiting workspace', 'Preparation', 'Done'],
        customFieldNames: ['Status', 'workspace'],
        statusFieldId: 'status-field-id',
      });

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

    it('should fetch user project data from GitHub API', async () => {
      const projectUrl = 'https://github.com/users/HiromiShikata/projects/49';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            user: {
              projectV2: {
                id: 'user-project-id',
                title: 'User Project',
                url: projectUrl,
                fields: {
                  nodes: [
                    {
                      id: 'user-status-field-id',
                      name: 'Status',
                      options: [{ name: 'Todo' }, { name: 'Done' }],
                    },
                  ],
                },
              },
            },
          },
        }),
      });

      const project = await repository.getByUrl(projectUrl);

      expect(project).toEqual({
        id: 'user-project-id',
        url: projectUrl,
        name: 'User Project',
        statuses: ['Todo', 'Done'],
        customFieldNames: ['Status'],
        statusFieldId: 'user-status-field-id',
      });

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

    it.each`
      invalidUrl                           | expectedError
      ${'https://example.com/invalid'}     | ${'Invalid GitHub project URL'}
      ${'https://github.com/owner/repo'}   | ${'Invalid GitHub project URL'}
      ${'https://github.com/projects/123'} | ${'Invalid GitHub project URL'}
      ${'not a url'}                       | ${'Invalid GitHub project URL'}
    `(
      'should throw error for invalid URL: $invalidUrl',
      async ({
        invalidUrl,
        expectedError,
      }: {
        invalidUrl: string;
        expectedError: string;
      }) => {
        await expect(repository.getByUrl(invalidUrl)).rejects.toThrow(
          expectedError,
        );
      },
    );
  });

  it('should throw error when response is not ok', async () => {
    const projectUrl = 'https://github.com/orgs/test-org/projects/1';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: jest.fn().mockResolvedValue('API Error'),
    });

    await expect(repository.getByUrl(projectUrl)).rejects.toThrow(
      'GitHub API error',
    );
  });

  it('should throw error when response format is invalid', async () => {
    const projectUrl = 'https://github.com/orgs/test-org/projects/1';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(null),
    });

    await expect(repository.getByUrl(projectUrl)).rejects.toThrow(
      'Invalid API response format',
    );
  });

  it('should throw error when project not found', async () => {
    const projectUrl = 'https://github.com/orgs/test-org/projects/1';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {},
      }),
    });

    await expect(repository.getByUrl(projectUrl)).rejects.toThrow(
      'Project not found',
    );
  });

  it('should fetch repository project data from GitHub API', async () => {
    const projectUrl =
      'https://github.com/HiromiShikata/test-repository/projects/1';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          organization: {
            projectV2: {
              id: 'repo-project-id',
              title: 'Repo Project',
              url: projectUrl,
              fields: {
                nodes: [
                  {
                    id: 'repo-status-field-id',
                    name: 'Status',
                    options: [{ name: 'Open' }, { name: 'Closed' }],
                  },
                ],
              },
            },
          },
        },
      }),
    });

    const project = await repository.getByUrl(projectUrl);

    expect(project).toEqual({
      id: 'repo-project-id',
      url: projectUrl,
      name: 'Repo Project',
      statuses: ['Open', 'Closed'],
      customFieldNames: ['Status'],
      statusFieldId: 'repo-status-field-id',
    });
  });

  it('should handle project without status field', async () => {
    const projectUrl = 'https://github.com/orgs/test-org/projects/2';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          organization: {
            projectV2: {
              id: 'project-without-status',
              title: 'Project Without Status',
              url: projectUrl,
              fields: {
                nodes: [
                  {
                    id: 'priority-field-id',
                    name: 'Priority',
                  },
                ],
              },
            },
          },
        },
      }),
    });

    const project = await repository.getByUrl(projectUrl);

    expect(project).toEqual({
      id: 'project-without-status',
      url: projectUrl,
      name: 'Project Without Status',
      statuses: [],
      customFieldNames: ['Priority'],
      statusFieldId: null,
    });
  });

  describe('prepareStatus', () => {
    it('should return project as-is when status already exists', async () => {
      const project = {
        id: 'project-id',
        url: 'https://github.com/orgs/test-org/projects/1',
        name: 'Test Project',
        statuses: ['Todo', 'In Progress', 'Done'],
        customFieldNames: ['Status'],
        statusFieldId: 'status-field-id',
      };

      const result = await repository.prepareStatus('In Progress', project);

      expect(result).toEqual(project);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should add new status when it does not exist', async () => {
      const project = {
        id: 'project-id',
        url: 'https://github.com/orgs/test-org/projects/1',
        name: 'Test Project',
        statuses: ['Todo', 'Done'],
        customFieldNames: ['Status'],
        statusFieldId: 'status-field-id',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            updateProjectV2Field: {
              projectV2Field: {
                id: 'status-field-id',
                name: 'Status',
                options: [
                  { name: 'Todo' },
                  { name: 'Done' },
                  { name: 'In Progress' },
                ],
              },
            },
          },
        }),
      });

      const result = await repository.prepareStatus('In Progress', project);

      expect(result).toEqual({
        ...project,
        statuses: ['Todo', 'Done', 'In Progress'],
      });

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

    it('should throw error when status field is not found', async () => {
      const project = {
        id: 'project-id',
        url: 'https://github.com/orgs/test-org/projects/1',
        name: 'Test Project',
        statuses: [],
        customFieldNames: ['Priority'],
        statusFieldId: null,
      };

      await expect(
        repository.prepareStatus('New Status', project),
      ).rejects.toThrow('Status field not found in project "Test Project"');
    });

    it('should throw error when GitHub API returns error', async () => {
      const project = {
        id: 'project-id',
        url: 'https://github.com/orgs/test-org/projects/1',
        name: 'Test Project',
        statuses: ['Todo'],
        customFieldNames: ['Status'],
        statusFieldId: 'status-field-id',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ errors: ['API Error'] }),
      });

      await expect(
        repository.prepareStatus('New Status', project),
      ).rejects.toThrow('GitHub API error');
    });

    it('should throw error when response format is invalid', async () => {
      const project = {
        id: 'project-id',
        url: 'https://github.com/orgs/test-org/projects/1',
        name: 'Test Project',
        statuses: ['Todo'],
        customFieldNames: ['Status'],
        statusFieldId: 'status-field-id',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(
        repository.prepareStatus('New Status', project),
      ).rejects.toThrow('Invalid API response format');
    });

    it('should throw error when response has GraphQL errors', async () => {
      const project = {
        id: 'project-id',
        url: 'https://github.com/orgs/test-org/projects/1',
        name: 'Test Project',
        statuses: ['Todo'],
        customFieldNames: ['Status'],
        statusFieldId: 'status-field-id',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          errors: [{ message: 'Permission denied' }],
        }),
      });

      await expect(
        repository.prepareStatus('New Status', project),
      ).rejects.toThrow('GraphQL errors');
    });
  });
});
