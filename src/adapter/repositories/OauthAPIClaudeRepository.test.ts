const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockCopyFileSync = jest.fn();
const mockHomedir = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
  copyFileSync: mockCopyFileSync,
}));

jest.mock('os', () => ({
  homedir: mockHomedir,
}));

import { OauthAPIClaudeRepository } from './OauthAPIClaudeRepository';
import * as path from 'path';

describe('OauthAPIClaudeRepository', () => {
  let repository: OauthAPIClaudeRepository;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockHomedir.mockReturnValue('/home/testuser');
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    jest.clearAllMocks();
  });

  const credentialsPath = path.join(
    '/home/testuser',
    '.claude',
    '.credentials.json',
  );

  describe('getUsage', () => {
    it('should fetch usage data from Claude API', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-access-token',
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: {
            utilization: 25.5,
            resets_at: '2026-01-12T10:00:00Z',
          },
          seven_day: {
            utilization: 50.0,
            resets_at: '2026-01-15T00:00:00Z',
          },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const usages = await repository.getUsage();

      expect(usages).toHaveLength(2);
      expect(usages[0]).toEqual({
        hour: 5,
        utilizationPercentage: 25.5,
        resetsAt: new Date('2026-01-12T10:00:00Z'),
      });
      expect(usages[1]).toEqual({
        hour: 168,
        utilizationPercentage: 50.0,
        resetsAt: new Date('2026-01-15T00:00:00Z'),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/api/oauth/usage',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'User-Agent': 'claude-code/2.0.32',
            Authorization: 'Bearer test-access-token',
            'anthropic-beta': 'oauth-2025-04-20',
          },
        }),
      );
    });

    it('should include opus and sonnet usage when available', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-access-token',
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: {
            utilization: 10.0,
            resets_at: '2026-01-12T10:00:00Z',
          },
          seven_day: {
            utilization: 20.0,
            resets_at: '2026-01-15T00:00:00Z',
          },
          seven_day_opus: {
            utilization: 30.0,
            resets_at: '2026-01-16T00:00:00Z',
          },
          seven_day_sonnet: {
            utilization: 40.0,
            resets_at: '2026-01-17T00:00:00Z',
          },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const usages = await repository.getUsage();

      expect(usages).toHaveLength(4);
      expect(usages[2]).toEqual({
        hour: 168,
        utilizationPercentage: 30.0,
        resetsAt: new Date('2026-01-16T00:00:00Z'),
      });
      expect(usages[3]).toEqual({
        hour: 168,
        utilizationPercentage: 40.0,
        resetsAt: new Date('2026-01-17T00:00:00Z'),
      });
    });

    it('should throw error when credentials file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      repository = new OauthAPIClaudeRepository();

      await expect(repository.getUsage()).rejects.toThrow(
        `Claude credentials file not found at ${credentialsPath}`,
      );
    });

    it('should throw error when access token is missing', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {},
        }),
      );

      repository = new OauthAPIClaudeRepository();

      await expect(repository.getUsage()).rejects.toThrow(
        'No access token found in credentials file',
      );
    });

    it('should throw error when credentials file has invalid format', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('null');

      repository = new OauthAPIClaudeRepository();

      await expect(repository.getUsage()).rejects.toThrow(
        'Invalid credentials file format',
      );
    });

    it('should throw error when API response is not ok', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-access-token',
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('API Error'),
      });

      repository = new OauthAPIClaudeRepository();

      await expect(repository.getUsage()).rejects.toThrow(
        'Claude API error: API Error',
      );
    });

    it('should throw error when API returns error in response', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-access-token',
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          error: 'Invalid token',
        }),
      });

      repository = new OauthAPIClaudeRepository();

      await expect(repository.getUsage()).rejects.toThrow(
        'API error: Invalid token',
      );
    });

    it('should throw error when API response format is invalid', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-access-token',
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      repository = new OauthAPIClaudeRepository();

      await expect(repository.getUsage()).rejects.toThrow(
        'Invalid API response format',
      );
    });

    it('should return empty array when no usage data available', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-access-token',
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      repository = new OauthAPIClaudeRepository();
      const usages = await repository.getUsage();

      expect(usages).toHaveLength(0);
    });

    it('should handle missing resets_at by using current date', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-access-token',
          },
        }),
      );

      const beforeTest = new Date();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: {
            utilization: 25.5,
          },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const usages = await repository.getUsage();

      const afterTest = new Date();

      expect(usages).toHaveLength(1);
      expect(usages[0].hour).toBe(5);
      expect(usages[0].utilizationPercentage).toBe(25.5);
      expect(usages[0].resetsAt.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime(),
      );
      expect(usages[0].resetsAt.getTime()).toBeLessThanOrEqual(
        afterTest.getTime(),
      );
    });

    it('should handle missing resets_at for all window types', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-access-token',
          },
        }),
      );

      const beforeTest = new Date();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: {
            utilization: 10.0,
          },
          seven_day: {
            utilization: 20.0,
          },
          seven_day_opus: {
            utilization: 30.0,
          },
          seven_day_sonnet: {
            utilization: 40.0,
          },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const usages = await repository.getUsage();

      const afterTest = new Date();

      expect(usages).toHaveLength(4);

      for (const usage of usages) {
        expect(usage.resetsAt.getTime()).toBeGreaterThanOrEqual(
          beforeTest.getTime(),
        );
        expect(usage.resetsAt.getTime()).toBeLessThanOrEqual(
          afterTest.getTime(),
        );
      }
    });
  });

  describe('isClaudeAvailable', () => {
    const claudeDir = path.join('/home/testuser', '.claude');

    it('should return false when claude directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(false);
    });

    it('should return false when no credential files exist', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['.credentials.json']);

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(false);
    });

    it('should return true and copy credential file when usage is under threshold', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.dev1.1',
      ]);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-token-dev1',
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: {
            utilization: 50.0,
            resets_at: '2026-01-12T10:00:00Z',
          },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(true);
      expect(mockCopyFileSync).toHaveBeenCalledWith(
        path.join(claudeDir, '.credentials.json.dev1.1'),
        path.join(claudeDir, '.credentials.json'),
      );
    });

    it('should return false when all credentials are over threshold', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.dev1.1',
      ]);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-token-dev1',
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: {
            utilization: 90.0,
            resets_at: '2026-01-12T10:00:00Z',
          },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(false);
      expect(mockCopyFileSync).not.toHaveBeenCalled();
    });

    it('should sort credentials by priority and try lower priority first', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.dev2.5',
        '.credentials.json.dev1.1',
      ]);

      const credentialContents: Record<string, string> = {
        [path.join(claudeDir, '.credentials.json.dev1.1')]: JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev1' },
        }),
        [path.join(claudeDir, '.credentials.json.dev2.5')]: JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev2' },
        }),
      };

      mockReadFileSync.mockImplementation((filePath: string) => {
        return credentialContents[filePath] || '';
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: { utilization: 30.0 },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/api/oauth/usage',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'User-Agent': 'claude-code/2.0.32',
            Authorization: 'Bearer token-dev1',
            'anthropic-beta': 'oauth-2025-04-20',
          },
        }),
      );
      expect(mockCopyFileSync).toHaveBeenCalledWith(
        path.join(claudeDir, '.credentials.json.dev1.1'),
        path.join(claudeDir, '.credentials.json'),
      );
    });

    it('should skip to next credential when API call fails', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.dev1.1',
        '.credentials.json.dev2.2',
      ]);

      const credentialContents: Record<string, string> = {
        [path.join(claudeDir, '.credentials.json.dev1.1')]: JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev1' },
        }),
        [path.join(claudeDir, '.credentials.json.dev2.2')]: JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev2' },
        }),
      };

      mockReadFileSync.mockImplementation((filePath: string) => {
        return credentialContents[filePath] || '';
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          text: jest.fn().mockResolvedValue('API Error'),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            five_hour: { utilization: 30.0 },
          }),
        });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockCopyFileSync).toHaveBeenCalledWith(
        path.join(claudeDir, '.credentials.json.dev2.2'),
        path.join(claudeDir, '.credentials.json'),
      );
    });

    it('should skip credential files with invalid format', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.invalid',
        '.credentials.json.dev1.1',
      ]);

      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev1' },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: { utilization: 30.0 },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(true);
      expect(mockCopyFileSync).toHaveBeenCalledWith(
        path.join(claudeDir, '.credentials.json.dev1.1'),
        path.join(claudeDir, '.credentials.json'),
      );
    });

    it('should skip credential files without access token', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.dev1.1',
        '.credentials.json.dev2.2',
      ]);

      const credentialContents: Record<string, string> = {
        [path.join(claudeDir, '.credentials.json.dev1.1')]: JSON.stringify({
          claudeAiOauth: {},
        }),
        [path.join(claudeDir, '.credentials.json.dev2.2')]: JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev2' },
        }),
      };

      mockReadFileSync.mockImplementation((filePath: string) => {
        return credentialContents[filePath] || '';
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: { utilization: 30.0 },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockCopyFileSync).toHaveBeenCalledWith(
        path.join(claudeDir, '.credentials.json.dev2.2'),
        path.join(claudeDir, '.credentials.json'),
      );
    });

    it('should check all usage windows against threshold', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.dev1.1',
      ]);

      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev1' },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: { utilization: 30.0 },
          seven_day: { utilization: 90.0 },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(false);
      expect(mockCopyFileSync).not.toHaveBeenCalled();
    });

    it('should return true when usage equals threshold minus 1', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.dev1.1',
      ]);

      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev1' },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: { utilization: 79.0 },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(true);
    });

    it('should return false when usage equals threshold', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.credentials.json',
        '.credentials.json.dev1.1',
      ]);

      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          claudeAiOauth: { accessToken: 'token-dev1' },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          five_hour: { utilization: 80.0 },
        }),
      });

      repository = new OauthAPIClaudeRepository();
      const result = await repository.isClaudeAvailable(80);

      expect(result).toBe(false);
    });
  });
});
