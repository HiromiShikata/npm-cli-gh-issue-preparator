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
const GitHubProjectRepository_1 = require("../../repositories/GitHubProjectRepository");
const GitHubIssueRepository_1 = require("../../repositories/GitHubIssueRepository");
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
    .option('--logFilePath <path>', 'Path to log file')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const projectRepository = new GitHubProjectRepository_1.GitHubProjectRepository(token);
    const issueRepository = new GitHubIssueRepository_1.GitHubIssueRepository(token);
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const useCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, localCommandRunner);
    await useCase.run({
        projectUrl: options.projectUrl,
        awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
        preparationStatus: options.preparationStatus,
        defaultAgentName: options.defaultAgentName,
        logFilePath: options.logFilePath,
    });
});
program
    .command('notifyFinishedIssuePreparation')
    .description('Notify that issue preparation is finished')
    .requiredOption('--projectUrl <url>', 'GitHub project URL')
    .requiredOption('--issueUrl <url>', 'GitHub issue URL')
    .requiredOption('--preparationStatus <status>', 'Status for issues in preparation')
    .requiredOption('--awaitingQualityCheckStatus <status>', 'Status for issues awaiting quality check')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const projectRepository = new GitHubProjectRepository_1.GitHubProjectRepository(token);
    const issueRepository = new GitHubIssueRepository_1.GitHubIssueRepository(token);
    const useCase = new NotifyFinishedIssuePreparationUseCase_1.NotifyFinishedIssuePreparationUseCase(projectRepository, issueRepository);
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