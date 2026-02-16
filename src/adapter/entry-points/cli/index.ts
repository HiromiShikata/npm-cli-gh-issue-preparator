#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';
import { TowerDefenceIssueRepository } from '../../repositories/TowerDefenceIssueRepository';
import { GraphqlIssueRepository } from '../../repositories/GraphqlIssueRepository';
import { TowerDefenceProjectRepository } from '../../repositories/TowerDefenceProjectRepository';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';
import { OauthAPIClaudeRepository } from '../../repositories/OauthAPIClaudeRepository';
import { Xfce4TerminalCopilotRepository } from '../../repositories/Xfce4TerminalCopilotRepository';

type StartDaemonOptions = {
  projectUrl: string;
  awaitingWorkspaceStatus: string;
  preparationStatus: string;
  defaultAgentName: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: string;
  configFilePath: string;
};

type NotifyFinishedOptions = {
  projectUrl: string;
  issueUrl: string;
  preparationStatus: string;
  awaitingAutoQualityCheckStatus: string;
  awaitingWorkspaceStatus: string;
  awaitingQualityCheckStatus: string;
  commentCountThreshold: string;
  thresholdForAutoReject?: string;
  configFilePath: string;
};

const program = new Command();
program
  .name('npm-cli-gh-issue-preparator')
  .description('CLI tool to prepare GitHub issues');

program
  .command('startDaemon')
  .description('Start daemon to prepare GitHub issues')
  .requiredOption('--projectUrl <url>', 'GitHub project URL')
  .requiredOption(
    '--awaitingWorkspaceStatus <status>',
    'Status for issues awaiting workspace',
  )
  .requiredOption(
    '--preparationStatus <status>',
    'Status for issues in preparation',
  )
  .requiredOption('--defaultAgentName <name>', 'Default agent name')
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .option('--logFilePath <path>', 'Path to log file')
  .option(
    '--maximumPreparingIssuesCount <count>',
    'Maximum number of issues in preparation status (default: 6)',
  )
  .action(async (options: StartDaemonOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const projectRepository = new TowerDefenceProjectRepository(
      options.configFilePath,
      token,
    );
    const towerDefenceIssueRepository = new TowerDefenceIssueRepository(
      options.configFilePath,
      token,
    );
    const graphqlIssueRepository = new GraphqlIssueRepository(token);
    const claudeRepository = new OauthAPIClaudeRepository();
    const localCommandRunner = new NodeLocalCommandRunner();

    const useCase = new StartPreparationUseCase(
      projectRepository,
      {
        getAllOpened: towerDefenceIssueRepository.getAllOpened.bind(
          towerDefenceIssueRepository,
        ),
        getStoryObjectMap: towerDefenceIssueRepository.getStoryObjectMap.bind(
          towerDefenceIssueRepository,
        ),
        update: graphqlIssueRepository.update.bind(graphqlIssueRepository),
      },
      claudeRepository,
      localCommandRunner,
    );

    let maximumPreparingIssuesCount: number | null = null;
    if (options.maximumPreparingIssuesCount !== undefined) {
      const parsedCount = Number(options.maximumPreparingIssuesCount);
      if (
        !Number.isFinite(parsedCount) ||
        !Number.isInteger(parsedCount) ||
        parsedCount <= 0
      ) {
        console.error(
          'Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.',
        );
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
  .requiredOption(
    '--preparationStatus <status>',
    'Status for issues in preparation',
  )
  .requiredOption(
    '--awaitingWorkspaceStatus <status>',
    'Status for issues awaiting workspace',
  )
  .requiredOption(
    '--awaitingAutoQualityCheckStatus <status>',
    'Status for issues awaiting auto quality check',
  )
  .requiredOption(
    '--awaitingQualityCheckStatus <status>',
    'Status for issues awaiting quality check',
  )
  .requiredOption(
    '--commentCountThreshold <count>',
    'Threshold of comment count to trigger manual quality check',
  )
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .option(
    '--thresholdForAutoReject <count>',
    'Threshold for auto-escalation after consecutive rejections (default: 3)',
  )
  .action(async (options: NotifyFinishedOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const commentCountThreshold = Number(options.commentCountThreshold);
    if (
      !Number.isFinite(commentCountThreshold) ||
      !Number.isInteger(commentCountThreshold) ||
      commentCountThreshold < 0
    ) {
      console.error(
        'Invalid value for --commentCountThreshold. It must be a non-negative integer.',
      );
      process.exit(1);
    }

    const projectRepository = new TowerDefenceProjectRepository(
      options.configFilePath,
      token,
    );
    const graphqlIssueRepository = new GraphqlIssueRepository(token);
    const issueCommentRepository = new GitHubIssueCommentRepository(token);
    const copilotRepository = new Xfce4TerminalCopilotRepository();

    const useCase = new NotifyFinishedIssuePreparationUseCase(
      projectRepository,
      graphqlIssueRepository,
      issueCommentRepository,
      copilotRepository,
    );

    let thresholdForAutoReject = 3;
    if (options.thresholdForAutoReject !== undefined) {
      const parsed = Number(options.thresholdForAutoReject);
      if (
        !Number.isFinite(parsed) ||
        !Number.isInteger(parsed) ||
        parsed <= 0
      ) {
        console.error(
          'Invalid value for --thresholdForAutoReject. It must be a positive integer.',
        );
        process.exit(1);
      }
      thresholdForAutoReject = parsed;
    }

    await useCase.run({
      projectUrl: options.projectUrl,
      issueUrl: options.issueUrl,
      preparationStatus: options.preparationStatus,
      awaitingAutoQualityCheckStatus: options.awaitingAutoQualityCheckStatus,
      awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
      awaitingQualityCheckStatus: options.awaitingQualityCheckStatus,
      commentCountThreshold,
      thresholdForAutoReject,
    });
  });

/* istanbul ignore next */
if (process.argv && require.main === module) {
  program.parse(process.argv);
}

export { program };
