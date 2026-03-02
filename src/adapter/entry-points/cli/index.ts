#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Command } from 'commander';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';
import { TowerDefenceIssueRepository } from '../../repositories/TowerDefenceIssueRepository';
import { GraphqlIssueRepository } from '../../repositories/GraphqlIssueRepository';
import { TowerDefenceProjectRepository } from '../../repositories/TowerDefenceProjectRepository';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';
import { OauthAPIClaudeRepository } from '../../repositories/OauthAPIClaudeRepository';

type ConfigFile = {
  projectUrl?: string;
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: number;
  utilizationPercentageThreshold?: number;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: number;
};

type StartDaemonOptions = {
  projectUrl?: string;
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: string;
  utilizationPercentageThreshold?: string;
  configFilePath: string;
};

type NotifyFinishedOptions = {
  issueUrl: string;
  projectUrl?: string;
  preparationStatus?: string;
  awaitingWorkspaceStatus?: string;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: string;
  workflowBlockerRepos?: string;
  configFilePath: string;
};

const getStringValue = (
  obj: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
};

const getNumberValue = (
  obj: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = obj[key];
  return typeof value === 'number' ? value : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const loadConfigFile = (configFilePath: string): ConfigFile => {
  try {
    const content = fs.readFileSync(configFilePath, 'utf-8');
    const parsed: unknown = yaml.load(content);
    if (!isRecord(parsed)) {
      return {};
    }
    return {
      projectUrl: getStringValue(parsed, 'projectUrl'),
      awaitingWorkspaceStatus: getStringValue(
        parsed,
        'awaitingWorkspaceStatus',
      ),
      preparationStatus: getStringValue(parsed, 'preparationStatus'),
      defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
      logFilePath: getStringValue(parsed, 'logFilePath'),
      maximumPreparingIssuesCount: getNumberValue(
        parsed,
        'maximumPreparingIssuesCount',
      ),
      utilizationPercentageThreshold: getNumberValue(
        parsed,
        'utilizationPercentageThreshold',
      ),
      awaitingQualityCheckStatus: getStringValue(
        parsed,
        'awaitingQualityCheckStatus',
      ),
      thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to load configuration file "${configFilePath}": ${message}`,
    );
    process.exit(1);
  }
};

const program = new Command();
program
  .name('npm-cli-gh-issue-preparator')
  .description('CLI tool to prepare GitHub issues');

program
  .command('startDaemon')
  .description('Start daemon to prepare GitHub issues')
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .option('--projectUrl <url>', 'GitHub project URL')
  .option(
    '--awaitingWorkspaceStatus <status>',
    'Status for issues awaiting workspace',
  )
  .option('--preparationStatus <status>', 'Status for issues in preparation')
  .option('--defaultAgentName <name>', 'Default agent name')
  .option('--logFilePath <path>', 'Path to log file')
  .option(
    '--maximumPreparingIssuesCount <count>',
    'Maximum number of issues in preparation status (default: 6)',
  )
  .option(
    '--utilizationPercentageThreshold <percentage>',
    'Claude usage percentage threshold for skipping preparation (default: 90)',
  )
  .action(async (options: StartDaemonOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const config = loadConfigFile(options.configFilePath);

    const projectUrl = options.projectUrl ?? config.projectUrl;
    const awaitingWorkspaceStatus =
      options.awaitingWorkspaceStatus ?? config.awaitingWorkspaceStatus;
    const preparationStatus =
      options.preparationStatus ?? config.preparationStatus;
    const defaultAgentName =
      options.defaultAgentName ?? config.defaultAgentName;
    const logFilePath = options.logFilePath ?? config.logFilePath;

    if (!projectUrl) {
      console.error(
        'projectUrl is required. Provide via --projectUrl or config file.',
      );
      process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
      console.error(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus or config file.',
      );
      process.exit(1);
    }
    if (!preparationStatus) {
      console.error(
        'preparationStatus is required. Provide via --preparationStatus or config file.',
      );
      process.exit(1);
    }
    if (!defaultAgentName) {
      console.error(
        'defaultAgentName is required. Provide via --defaultAgentName or config file.',
      );
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
    const rawMaxCount =
      options.maximumPreparingIssuesCount ?? config.maximumPreparingIssuesCount;
    if (rawMaxCount !== undefined) {
      const parsedCount = Number(rawMaxCount);
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

    let utilizationPercentageThreshold = 90;
    const rawThreshold =
      options.utilizationPercentageThreshold ??
      config.utilizationPercentageThreshold;
    if (rawThreshold !== undefined) {
      const parsedThreshold = Number(rawThreshold);
      if (
        !Number.isFinite(parsedThreshold) ||
        parsedThreshold < 0 ||
        parsedThreshold > 100
      ) {
        console.error(
          'Invalid value for --utilizationPercentageThreshold. It must be a number between 0 and 100.',
        );
        process.exit(1);
      }
      utilizationPercentageThreshold = parsedThreshold;
    }

    await useCase.run({
      projectUrl,
      awaitingWorkspaceStatus,
      preparationStatus,
      defaultAgentName,
      logFilePath,
      maximumPreparingIssuesCount,
      utilizationPercentageThreshold,
    });
  });

program
  .command('notifyFinishedIssuePreparation')
  .description('Notify that issue preparation is finished')
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .requiredOption('--issueUrl <url>', 'GitHub issue URL')
  .option('--projectUrl <url>', 'GitHub project URL')
  .option('--preparationStatus <status>', 'Status for issues in preparation')
  .option(
    '--awaitingWorkspaceStatus <status>',
    'Status for issues awaiting workspace',
  )
  .option(
    '--awaitingQualityCheckStatus <status>',
    'Status for issues awaiting quality check',
  )
  .option(
    '--thresholdForAutoReject <count>',
    'Threshold for auto-escalation after consecutive rejections (default: 3)',
  )
  .option(
    '--workflowBlockerRepos <repos>',
    'Comma-separated list of org/repo with active workflow blockers',
  )
  .action(async (options: NotifyFinishedOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const config = loadConfigFile(options.configFilePath);

    const projectUrl = options.projectUrl ?? config.projectUrl;
    const preparationStatus =
      options.preparationStatus ?? config.preparationStatus;
    const awaitingWorkspaceStatus =
      options.awaitingWorkspaceStatus ?? config.awaitingWorkspaceStatus;
    const awaitingQualityCheckStatus =
      options.awaitingQualityCheckStatus ?? config.awaitingQualityCheckStatus;

    if (!projectUrl) {
      console.error(
        'projectUrl is required. Provide via --projectUrl or config file.',
      );
      process.exit(1);
    }
    if (!preparationStatus) {
      console.error(
        'preparationStatus is required. Provide via --preparationStatus or config file.',
      );
      process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
      console.error(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus or config file.',
      );
      process.exit(1);
    }
    if (!awaitingQualityCheckStatus) {
      console.error(
        'awaitingQualityCheckStatus is required. Provide via --awaitingQualityCheckStatus or config file.',
      );
      process.exit(1);
    }

    const projectRepository = new TowerDefenceProjectRepository(
      options.configFilePath,
      token,
    );
    const graphqlIssueRepository = new GraphqlIssueRepository(token);
    const issueCommentRepository = new GitHubIssueCommentRepository(token);

    const useCase = new NotifyFinishedIssuePreparationUseCase(
      projectRepository,
      graphqlIssueRepository,
      issueCommentRepository,
    );

    let thresholdForAutoReject = 3;
    const rawThreshold =
      options.thresholdForAutoReject ?? config.thresholdForAutoReject;
    if (rawThreshold !== undefined) {
      const parsed = Number(rawThreshold);
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

    const workflowBlockerRepos = options.workflowBlockerRepos
      ? options.workflowBlockerRepos
          .split(',')
          .map((r: string) => r.trim())
          .filter((r: string) => r.length > 0)
      : undefined;

    await useCase.run({
      projectUrl,
      issueUrl: options.issueUrl,
      preparationStatus,
      awaitingWorkspaceStatus,
      awaitingQualityCheckStatus,
      thresholdForAutoReject,
      workflowBlockerRepos,
    });
  });

/* istanbul ignore next */
if (process.argv && require.main === module) {
  program.parse(process.argv);
}

export { program, loadConfigFile };
