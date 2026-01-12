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
class OauthAPIClaudeRepository {
    constructor() {
        this.credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json');
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
}
exports.OauthAPIClaudeRepository = OauthAPIClaudeRepository;
//# sourceMappingURL=OauthAPIClaudeRepository.js.map