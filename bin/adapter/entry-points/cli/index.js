#!/usr/bin/env node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigFile = exports.program = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
const commander_1 = require("commander");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const NotifyFinishedIssuePreparationUseCase_1 = require("../../../domain/usecases/NotifyFinishedIssuePreparationUseCase");
const TowerDefenceIssueRepository_1 = require("../../repositories/TowerDefenceIssueRepository");
const GraphqlIssueRepository_1 = require("../../repositories/GraphqlIssueRepository");
const TowerDefenceProjectRepository_1 = require("../../repositories/TowerDefenceProjectRepository");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const OauthAPIClaudeRepository_1 = require("../../repositories/OauthAPIClaudeRepository");
const getStringValue = (obj, key) => {
    const value = obj[key];
    return typeof value === 'string' ? value : undefined;
};
const getNumberValue = (obj, key) => {
    const value = obj[key];
    return typeof value === 'number' ? value : undefined;
};
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const loadConfigFile = (configFilePath) => {
    try {
        const content = fs.readFileSync(configFilePath, 'utf-8');
        const parsed = yaml.load(content);
        if (!isRecord(parsed)) {
            return {};
        }
        return {
            projectUrl: getStringValue(parsed, 'projectUrl'),
            awaitingWorkspaceStatus: getStringValue(parsed, 'awaitingWorkspaceStatus'),
            preparationStatus: getStringValue(parsed, 'preparationStatus'),
            defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
            logFilePath: getStringValue(parsed, 'logFilePath'),
            maximumPreparingIssuesCount: getNumberValue(parsed, 'maximumPreparingIssuesCount'),
            utilizationPercentageThreshold: getNumberValue(parsed, 'utilizationPercentageThreshold'),
            allowedIssueAuthors: getStringValue(parsed, 'allowedIssueAuthors'),
            awaitingQualityCheckStatus: getStringValue(parsed, 'awaitingQualityCheckStatus'),
            thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load configuration file "${configFilePath}": ${message}`);
        process.exit(1);
    }
};
exports.loadConfigFile = loadConfigFile;
const program = new commander_1.Command();
exports.program = program;
program
    .name('npm-cli-gh-issue-preparator')
    .description('CLI tool to prepare GitHub issues');
program
    .command('startDaemon')
    .description('Start daemon to prepare GitHub issues')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .option('--projectUrl <url>', 'GitHub project URL')
    .option('--awaitingWorkspaceStatus <status>', 'Status for issues awaiting workspace')
    .option('--preparationStatus <status>', 'Status for issues in preparation')
    .option('--defaultAgentName <name>', 'Default agent name')
    .option('--logFilePath <path>', 'Path to log file')
    .option('--maximumPreparingIssuesCount <count>', 'Maximum number of issues in preparation status (default: 6)')
    .option('--utilizationPercentageThreshold <percentage>', 'Claude usage percentage threshold for skipping preparation (default: 90)')
    .option('--allowedIssueAuthors <authors>', 'Comma-separated list of allowed issue authors (default: all authors allowed)')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const config = loadConfigFile(options.configFilePath);
    const projectUrl = options.projectUrl ?? config.projectUrl;
    const awaitingWorkspaceStatus = options.awaitingWorkspaceStatus ?? config.awaitingWorkspaceStatus;
    const preparationStatus = options.preparationStatus ?? config.preparationStatus;
    const defaultAgentName = options.defaultAgentName ?? config.defaultAgentName;
    const logFilePath = options.logFilePath ?? config.logFilePath;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl or config file.');
        process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
        console.error('awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus or config file.');
        process.exit(1);
    }
    if (!preparationStatus) {
        console.error('preparationStatus is required. Provide via --preparationStatus or config file.');
        process.exit(1);
    }
    if (!defaultAgentName) {
        console.error('defaultAgentName is required. Provide via --defaultAgentName or config file.');
        process.exit(1);
    }
    const projectRepository = new TowerDefenceProjectRepository_1.TowerDefenceProjectRepository(options.configFilePath, token);
    const towerDefenceIssueRepository = new TowerDefenceIssueRepository_1.TowerDefenceIssueRepository(options.configFilePath, token);
    const graphqlIssueRepository = new GraphqlIssueRepository_1.GraphqlIssueRepository(token);
    const claudeRepository = new OauthAPIClaudeRepository_1.OauthAPIClaudeRepository();
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const useCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, {
        getAllOpened: towerDefenceIssueRepository.getAllOpened.bind(towerDefenceIssueRepository),
        getStoryObjectMap: towerDefenceIssueRepository.getStoryObjectMap.bind(towerDefenceIssueRepository),
        update: graphqlIssueRepository.update.bind(graphqlIssueRepository),
    }, claudeRepository, localCommandRunner);
    let maximumPreparingIssuesCount = null;
    const rawMaxCount = options.maximumPreparingIssuesCount ?? config.maximumPreparingIssuesCount;
    if (rawMaxCount !== undefined) {
        const parsedCount = Number(rawMaxCount);
        if (!Number.isFinite(parsedCount) ||
            !Number.isInteger(parsedCount) ||
            parsedCount <= 0) {
            console.error('Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.');
            process.exit(1);
        }
        maximumPreparingIssuesCount = parsedCount;
    }
    let utilizationPercentageThreshold = 90;
    const rawThreshold = options.utilizationPercentageThreshold ??
        config.utilizationPercentageThreshold;
    if (rawThreshold !== undefined) {
        const parsedThreshold = Number(rawThreshold);
        if (!Number.isFinite(parsedThreshold) ||
            parsedThreshold < 0 ||
            parsedThreshold > 100) {
            console.error('Invalid value for --utilizationPercentageThreshold. It must be a number between 0 and 100.');
            process.exit(1);
        }
        utilizationPercentageThreshold = parsedThreshold;
    }
    const rawAllowedAuthors = options.allowedIssueAuthors ?? config.allowedIssueAuthors;
    const parsedAllowedIssueAuthors = rawAllowedAuthors
        ? rawAllowedAuthors
            .split(',')
            .map((a) => a.trim())
            .filter((a) => a.length > 0)
        : null;
    const allowedIssueAuthors = parsedAllowedIssueAuthors && parsedAllowedIssueAuthors.length > 0
        ? parsedAllowedIssueAuthors
        : null;
    await useCase.run({
        projectUrl,
        awaitingWorkspaceStatus,
        preparationStatus,
        defaultAgentName,
        logFilePath,
        maximumPreparingIssuesCount,
        utilizationPercentageThreshold,
        allowedIssueAuthors,
    });
});
program
    .command('notifyFinishedIssuePreparation')
    .description('Notify that issue preparation is finished')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .requiredOption('--issueUrl <url>', 'GitHub issue URL')
    .option('--projectUrl <url>', 'GitHub project URL')
    .option('--preparationStatus <status>', 'Status for issues in preparation')
    .option('--awaitingWorkspaceStatus <status>', 'Status for issues awaiting workspace')
    .option('--awaitingQualityCheckStatus <status>', 'Status for issues awaiting quality check')
    .option('--thresholdForAutoReject <count>', 'Threshold for auto-escalation after consecutive rejections (default: 3)')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const config = loadConfigFile(options.configFilePath);
    const projectUrl = options.projectUrl ?? config.projectUrl;
    const preparationStatus = options.preparationStatus ?? config.preparationStatus;
    const awaitingWorkspaceStatus = options.awaitingWorkspaceStatus ?? config.awaitingWorkspaceStatus;
    const awaitingQualityCheckStatus = options.awaitingQualityCheckStatus ?? config.awaitingQualityCheckStatus;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl or config file.');
        process.exit(1);
    }
    if (!preparationStatus) {
        console.error('preparationStatus is required. Provide via --preparationStatus or config file.');
        process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
        console.error('awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus or config file.');
        process.exit(1);
    }
    if (!awaitingQualityCheckStatus) {
        console.error('awaitingQualityCheckStatus is required. Provide via --awaitingQualityCheckStatus or config file.');
        process.exit(1);
    }
    const projectRepository = new TowerDefenceProjectRepository_1.TowerDefenceProjectRepository(options.configFilePath, token);
    const graphqlIssueRepository = new GraphqlIssueRepository_1.GraphqlIssueRepository(token);
    const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(token);
    const useCase = new NotifyFinishedIssuePreparationUseCase_1.NotifyFinishedIssuePreparationUseCase(projectRepository, graphqlIssueRepository, issueCommentRepository);
    let thresholdForAutoReject = 3;
    const rawThreshold = options.thresholdForAutoReject ?? config.thresholdForAutoReject;
    if (rawThreshold !== undefined) {
        const parsed = Number(rawThreshold);
        if (!Number.isFinite(parsed) ||
            !Number.isInteger(parsed) ||
            parsed <= 0) {
            console.error('Invalid value for --thresholdForAutoReject. It must be a positive integer.');
            process.exit(1);
        }
        thresholdForAutoReject = parsed;
    }
    await useCase.run({
        projectUrl,
        issueUrl: options.issueUrl,
        preparationStatus,
        awaitingWorkspaceStatus,
        awaitingQualityCheckStatus,
        thresholdForAutoReject,
    });
});
/* istanbul ignore next */
if (process.argv && require.main === module) {
    program.parse(process.argv);
}
//# sourceMappingURL=index.js.map