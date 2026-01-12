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

type CredentialInfo = {
  name: string;
  priority: number;
  filePath: string;
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

const findCredentials = (filePathList: string[]): CredentialInfo[] => {
  const credentials: CredentialInfo[] = [];
  const baseFileName = '.credentials.json';

  for (const filePath of filePathList) {
    const fileName = path.basename(filePath);
    if (!fileName.startsWith(baseFileName)) {
      continue;
    }

    if (fileName === baseFileName) {
      continue;
    }

    const suffix = fileName.slice(baseFileName.length + 1);
    const parts = suffix.split('.');
    if (parts.length !== 2) {
      continue;
    }

    const name = parts[0];
    const priorityStr = parts[1];
    const priority = parseInt(priorityStr, 10);

    if (isNaN(priority)) {
      continue;
    }

    credentials.push({
      name,
      priority,
      filePath,
    });
  }

  return credentials.sort((a, b) => a.priority - b.priority);
};

export class OauthAPIClaudeRepository implements ClaudeRepository {
  private readonly credentialsPath: string;
  private readonly claudeDir: string;

  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.credentialsPath = path.join(this.claudeDir, '.credentials.json');
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

  private async getUsageWithToken(accessToken: string): Promise<UsageResponse> {
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

    return responseData;
  }

  private isUsageUnderThreshold(
    usageResponse: UsageResponse,
    threshold: number,
  ): boolean {
    const windows = [
      usageResponse.five_hour,
      usageResponse.seven_day,
      usageResponse.seven_day_opus,
      usageResponse.seven_day_sonnet,
    ];

    for (const window of windows) {
      if (
        window?.utilization !== undefined &&
        window.utilization >= threshold
      ) {
        return false;
      }
    }

    return true;
  }

  async isClaudeAvailable(threshold: number): Promise<boolean> {
    if (!fs.existsSync(this.claudeDir)) {
      return false;
    }

    const files = fs.readdirSync(this.claudeDir);
    const filePathList = files
      .filter((file) => file.startsWith('.credentials.json'))
      .map((file) => path.join(this.claudeDir, file));

    const credentials = findCredentials(filePathList);

    if (credentials.length === 0) {
      return false;
    }

    for (const credential of credentials) {
      const fileContent = fs.readFileSync(credential.filePath, 'utf-8');
      const credentialData: unknown = JSON.parse(fileContent);

      if (!isCredentialsFile(credentialData)) {
        continue;
      }

      const accessToken = credentialData.claudeAiOauth?.accessToken;
      if (!accessToken) {
        continue;
      }

      try {
        const usageResponse = await this.getUsageWithToken(accessToken);

        if (this.isUsageUnderThreshold(usageResponse, threshold)) {
          fs.copyFileSync(credential.filePath, this.credentialsPath);
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }
}
