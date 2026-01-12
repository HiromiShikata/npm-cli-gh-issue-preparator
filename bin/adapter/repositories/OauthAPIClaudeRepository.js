"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OauthAPIClaudeRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const isCredentialsFile = (value) => {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
};
const isUsageResponse = (value) => {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
};
const findCredentials = (filePathList) => {
    const credentials = [];
    const baseFileName = '.credentials.json';
    for (const filePath of filePathList) {
        const fileName = path.basename(filePath);
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
class OauthAPIClaudeRepository {
    constructor() {
        this.claudeDir = path.join(os.homedir(), '.claude');
        this.credentialsPath = path.join(this.claudeDir, '.credentials.json');
    }
    getAccessToken() {
        if (!fs.existsSync(this.credentialsPath)) {
            throw new Error(`Claude credentials file not found at ${this.credentialsPath}. Please login to Claude Code first using: claude login`);
        }
        const fileContent = fs.readFileSync(this.credentialsPath, 'utf-8');
        const credentials = JSON.parse(fileContent);
        if (!isCredentialsFile(credentials)) {
            throw new Error('Invalid credentials file format');
        }
        const accessToken = credentials.claudeAiOauth?.accessToken;
        if (!accessToken) {
            throw new Error('No access token found in credentials file');
        }
        return accessToken;
    }
    async getUsage() {
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
        const responseData = await response.json();
        if (!isUsageResponse(responseData)) {
            throw new Error('Invalid API response format');
        }
        if (responseData.error) {
            throw new Error(`API error: ${responseData.error}`);
        }
        const usages = [];
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
    async getUsageWithToken(accessToken) {
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
        const responseData = await response.json();
        if (!isUsageResponse(responseData)) {
            throw new Error('Invalid API response format');
        }
        if (responseData.error) {
            throw new Error(`API error: ${responseData.error}`);
        }
        return responseData;
    }
    isUsageUnderThreshold(usageResponse, threshold) {
        const windows = [
            usageResponse.five_hour,
            usageResponse.seven_day,
            usageResponse.seven_day_opus,
            usageResponse.seven_day_sonnet,
        ];
        for (const window of windows) {
            if (window?.utilization !== undefined &&
                window.utilization >= threshold) {
                return false;
            }
        }
        return true;
    }
    async isClaudeAvailable(threshold) {
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
            const credentialData = JSON.parse(fileContent);
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
            }
            catch {
                continue;
            }
        }
        return false;
    }
}
exports.OauthAPIClaudeRepository = OauthAPIClaudeRepository;
//# sourceMappingURL=OauthAPIClaudeRepository.js.map