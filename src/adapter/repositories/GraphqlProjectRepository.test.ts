import { GraphqlProjectRepository } from './GraphqlProjectRepository';

describe('GraphqlProjectRepository', () => {
  const token = 'test-token';
  let repository: GraphqlProjectRepository;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    repository = new GraphqlProjectRepository(token);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const mockFetchResponse = (response: {
    ok: boolean;
    status?: number;
    json?: () => Promise<unknown>;
  }): void => {
    fetchSpy.mockResolvedValue(response);
  };

  describe('fetchReadme', () => {
    it('should return readme from organization project', async () => {
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              organization: {
                projectV2: {
                  readme: '# My Project\nSome readme content',
                },
              },
              user: null,
            },
          }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBe('# My Project\nSome readme content');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
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

    it('should include owner in request body', async () => {
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              organization: {
                projectV2: { readme: 'test' },
              },
              user: null,
            },
          }),
      });

      await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      const body = JSON.stringify(fetchSpy.mock.lastCall);
      expect(body).toContain('\\"owner\\":\\"my-org\\"');
    });

    it('should return readme from user project', async () => {
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              organization: null,
              user: {
                projectV2: {
                  readme: '# User Project README',
                },
              },
            },
          }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/users/my-user/projects/10',
      );

      expect(result).toBe('# User Project README');
    });

    it('should return null when readme is null', async () => {
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              organization: {
                projectV2: {
                  readme: null,
                },
              },
              user: null,
            },
          }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
    });

    it('should return null when API response is not ok', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockFetchResponse({
        ok: false,
        status: 401,
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch project README from GitHub GraphQL API',
      );
      consoleWarnSpy.mockRestore();
    });

    it('should return null when response data is not a valid structure', async () => {
      mockFetchResponse({
        ok: true,
        json: () => Promise.resolve('not an object'),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
    });

    it('should return null when response data is an array', async () => {
      mockFetchResponse({
        ok: true,
        json: () => Promise.resolve([1, 2, 3]),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
    });

    it('should return null when data field is not an object', async () => {
      mockFetchResponse({
        ok: true,
        json: () => Promise.resolve({ data: 'invalid' }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
    });

    it('should return null and warn when GraphQL errors are present', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            errors: [{ message: 'Field "readme" not found' }],
          }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('GraphQL errors in project README response'),
      );
      consoleWarnSpy.mockRestore();
    });

    it('should return null and warn when GraphQL errors with partial data', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              organization: null,
              user: null,
            },
            errors: [{ message: 'Insufficient permissions' }],
          }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient permissions'),
      );
      consoleWarnSpy.mockRestore();
    });

    it('should return null when no project data exists', async () => {
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              organization: null,
              user: null,
            },
          }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
    });

    it('should throw error for invalid project URL', async () => {
      await expect(
        repository.fetchReadme('https://github.com/invalid-url'),
      ).rejects.toThrow('Invalid GitHub project URL');
    });

    it('should parse project number correctly', async () => {
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              organization: {
                projectV2: {
                  readme: 'test',
                },
              },
              user: null,
            },
          }),
      });

      await repository.fetchReadme(
        'https://github.com/orgs/test-org/projects/123',
      );

      const serializedCall = JSON.stringify(fetchSpy.mock.lastCall);
      expect(serializedCall).toContain('\\"owner\\":\\"test-org\\"');
      expect(serializedCall).toContain('\\"number\\":123');
    });
  });
});
