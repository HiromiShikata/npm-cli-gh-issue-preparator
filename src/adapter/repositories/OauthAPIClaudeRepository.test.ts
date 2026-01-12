const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockHomedir = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
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
});
