#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.program = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const commander_1 = require("commander");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const NotifyFinishedIssuePreparationUseCase_1 = require("../../../domain/usecases/NotifyFinishedIssuePreparationUseCase");
const TowerDefenceIssueRepository_1 = require("../../repositories/TowerDefenceIssueRepository");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const program = new commander_1.Command();
exports.program = program;
program
    .name('npm-cli-gh-issue-preparator')
    .description('CLI tool to prepare GitHub issues');
program
    .command('startDaemon')
    .description('Start daemon to prepare GitHub issues')
    .requiredOption('--projectUrl <url>', 'GitHub project URL')
    .requiredOption('--awaitingWorkspaceStatus <status>', 'Status for issues awaiting workspace')
    .requiredOption('--preparationStatus <status>', 'Status for issues in preparation')
    .requiredOption('--defaultAgentName <name>', 'Default agent name')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .option('--logFilePath <path>', 'Path to log file')
    .option('--maximumPreparingIssuesCount <count>', 'Maximum number of issues in preparation status (default: 6)')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const issueRepository = new TowerDefenceIssueRepository_1.TowerDefenceIssueRepository(options.configFilePath, token);
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const useCase = new StartPreparationUseCase_1.StartPreparationUseCase(issueRepository, localCommandRunner);
    let maximumPreparingIssuesCount = null;
    if (options.maximumPreparingIssuesCount !== undefined) {
        const parsedCount = Number(options.maximumPreparingIssuesCount);
        if (!Number.isFinite(parsedCount) ||
            !Number.isInteger(parsedCount) ||
            parsedCount <= 0) {
            console.error('Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.');
            process.exit(1);
        }
        maximumPreparingIssuesCount = parsedCount;
    }
    await useCase.run({
        projectUrl: options.projectUrl,
        awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
        preparationStatus: options.preparationStatus,
        defaultAgentName: options.defaultAgentName,
        logFilePath: options.logFilePath,
        maximumPreparingIssuesCount,
    });
});
program
    .command('notifyFinishedIssuePreparation')
    .description('Notify that issue preparation is finished')
    .requiredOption('--projectUrl <url>', 'GitHub project URL')
    .requiredOption('--issueUrl <url>', 'GitHub issue URL')
    .requiredOption('--preparationStatus <status>', 'Status for issues in preparation')
    .requiredOption('--awaitingQualityCheckStatus <status>', 'Status for issues awaiting quality check')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const issueRepository = new TowerDefenceIssueRepository_1.TowerDefenceIssueRepository(options.configFilePath, token);
    const useCase = new NotifyFinishedIssuePreparationUseCase_1.NotifyFinishedIssuePreparationUseCase(issueRepository);
    await useCase.run({
        projectUrl: options.projectUrl,
        issueUrl: options.issueUrl,
        preparationStatus: options.preparationStatus,
        awaitingQualityCheckStatus: options.awaitingQualityCheckStatus,
    });
});
/* istanbul ignore next */
if (process.argv && require.main === module) {
    program.parse(process.argv);
}
//# sourceMappingURL=index.js.map