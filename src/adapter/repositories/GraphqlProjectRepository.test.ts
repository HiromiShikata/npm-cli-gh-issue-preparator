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

    it('should return readme when organization succeeds but user query returns NOT_FOUND error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockFetchResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              organization: {
                projectV2: {
                  readme: '# Org Project README',
                },
              },
              user: null,
            },
            errors: [
              {
                message:
                  "Could not resolve to a User with the login of 'my-org'.",
              },
            ],
          }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBe('# Org Project README');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should return readme when user succeeds but organization query returns NOT_FOUND error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
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
            errors: [
              {
                message:
                  "Could not resolve to a Organization with the login of 'my-user'.",
              },
            ],
          }),
      });

      const result = await repository.fetchReadme(
        'https://github.com/users/my-user/projects/10',
      );

      expect(result).toBe('# User Project README');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
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

    it('should retry on HTTP 429 and return readme when retry succeeds', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new GraphqlProjectRepository(
        token,
        [5000, 15000, 45000],
        mockSleep,
      );
      fetchSpy
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                organization: {
                  projectV2: { readme: '# Readme after retry' },
                },
                user: null,
              },
            }),
        });

      const result = await retryRepository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBe('# Readme after retry');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledWith(5000);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Rate limited fetching project README, retrying in 5s',
        ),
      );
      consoleLogSpy.mockRestore();
    });

    it('should retry on GraphQL RATE_LIMIT error and return readme when retry succeeds', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new GraphqlProjectRepository(
        token,
        [5000, 15000, 45000],
        mockSleep,
      );
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              errors: [
                {
                  type: 'RATE_LIMIT',
                  message: 'API rate limit already exceeded for user ID 123.',
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                organization: {
                  projectV2: { readme: '# Readme after rate limit retry' },
                },
                user: null,
              },
            }),
        });

      const result = await retryRepository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBe('# Readme after rate limit retry');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledWith(5000);
      consoleLogSpy.mockRestore();
    });

    it('should return null after exhausting all retries on HTTP 429', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new GraphqlProjectRepository(
        token,
        [5000, 15000, 45000],
        mockSleep,
      );
      fetchSpy.mockResolvedValue({ ok: false, status: 429 });

      const result = await retryRepository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(mockSleep).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenNthCalledWith(1, 5000);
      expect(mockSleep).toHaveBeenNthCalledWith(2, 15000);
      expect(mockSleep).toHaveBeenNthCalledWith(3, 45000);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Rate limit exceeded fetching project README, all retries exhausted',
      );
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should return null after exhausting all retries on GraphQL RATE_LIMIT error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new GraphqlProjectRepository(
        token,
        [5000, 15000, 45000],
        mockSleep,
      );
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errors: [
              {
                type: 'RATE_LIMIT',
                code: 'graphql_rate_limit',
                message: 'API rate limit already exceeded for user ID 123.',
              },
            ],
          }),
      });

      const result = await retryRepository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(result).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(mockSleep).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Rate limited fetching project README, all retries exhausted',
        ),
      );
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should use exponential backoff delays between retries', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new GraphqlProjectRepository(
        token,
        [5000, 15000, 45000],
        mockSleep,
      );
      fetchSpy.mockResolvedValue({ ok: false, status: 429 });

      await retryRepository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(mockSleep).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenNthCalledWith(1, 5000);
      expect(mockSleep).toHaveBeenNthCalledWith(2, 15000);
      expect(mockSleep).toHaveBeenNthCalledWith(3, 45000);
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should log retry attempt number and delay', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new GraphqlProjectRepository(
        token,
        [5000, 15000, 45000],
        mockSleep,
      );
      fetchSpy
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                organization: { projectV2: { readme: 'ok' } },
                user: null,
              },
            }),
        });

      await retryRepository.fetchReadme(
        'https://github.com/orgs/my-org/projects/42',
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 5s... (attempt 1/3)'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 15s... (attempt 2/3)'),
      );
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});
