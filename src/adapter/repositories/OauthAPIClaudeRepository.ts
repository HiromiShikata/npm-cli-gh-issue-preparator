import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type CredentialsFile = {
  claudeAiOauth?: {
    accessToken?: string;
  };
};

type UsageWindow = {
  utilization?: number;
  resets_at?: string;
};

type UsageResponse = {
  five_hour?: UsageWindow;
  seven_day?: UsageWindow;
  seven_day_opus?: UsageWindow;
  seven_day_sonnet?: UsageWindow;
  error?: string;
};

const isCredentialsFile = (value: unknown): value is CredentialsFile => {
  if (typeof value !== 'object' || value === null) return false;
  return true;
};

const isUsageResponse = (value: unknown): value is UsageResponse => {
  if (typeof value !== 'object' || value === null) return false;
  return true;
};

export class OauthAPIClaudeRepository implements ClaudeRepository {
  private readonly credentialsPath: string;

  constructor() {
    this.credentialsPath = path.join(
      os.homedir(),
      '.claude',
      '.credentials.json',
    );
  }

  private getAccessToken(): string {
    if (!fs.existsSync(this.credentialsPath)) {
      throw new Error(
        `Claude credentials file not found at ${this.credentialsPath}. Please login to Claude Code first using: claude login`,
      );
    }

    const fileContent = fs.readFileSync(this.credentialsPath, 'utf-8');
    const credentials: unknown = JSON.parse(fileContent);

    if (!isCredentialsFile(credentials)) {
      throw new Error('Invalid credentials file format');
    }

    const accessToken = credentials.claudeAiOauth?.accessToken;

    if (!accessToken) {
      throw new Error('No access token found in credentials file');
    }

    return accessToken;
  }

  async getUsage(): Promise<ClaudeWindowUsage[]> {
    const accessToken = this.getAccessToken();

    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': 'claude-code/2.0.32',
        Authorization: `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${errorText}`);
    }

    const responseData: unknown = await response.json();

    if (!isUsageResponse(responseData)) {
      throw new Error('Invalid API response format');
    }

    if (responseData.error) {
      throw new Error(`API error: ${responseData.error}`);
    }

    const usages: ClaudeWindowUsage[] = [];

    if (responseData.five_hour?.utilization !== undefined) {
      usages.push({
        hour: 5,
        utilizationPercentage: responseData.five_hour.utilization,
        resetsAt: responseData.five_hour.resets_at
          ? new Date(responseData.five_hour.resets_at)
          : new Date(),
      });
    }

    if (responseData.seven_day?.utilization !== undefined) {
      usages.push({
        hour: 168,
        utilizationPercentage: responseData.seven_day.utilization,
        resetsAt: responseData.seven_day.resets_at
          ? new Date(responseData.seven_day.resets_at)
          : new Date(),
      });
    }

    if (responseData.seven_day_opus?.utilization !== undefined) {
      usages.push({
        hour: 168,
        utilizationPercentage: responseData.seven_day_opus.utilization,
        resetsAt: responseData.seven_day_opus.resets_at
          ? new Date(responseData.seven_day_opus.resets_at)
          : new Date(),
      });
    }

    if (responseData.seven_day_sonnet?.utilization !== undefined) {
      usages.push({
        hour: 168,
        utilizationPercentage: responseData.seven_day_sonnet.utilization,
        resetsAt: responseData.seven_day_sonnet.resets_at
          ? new Date(responseData.seven_day_sonnet.resets_at)
          : new Date(),
      });
    }

    return usages;
  }
}
