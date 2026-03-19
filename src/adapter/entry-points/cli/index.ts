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
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';
import { OauthAPIClaudeRepository } from '../../repositories/OauthAPIClaudeRepository';
import { FetchWebhookRepository } from '../../repositories/FetchWebhookRepository';

type ConfigFile = {
  projectUrl?: string;
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  defaultLlmModelName?: string;
  defaultLlmAgentName?: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: number;
  utilizationPercentageThreshold?: number;
  allowedIssueAuthors?: string;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: number;
  workflowBlockerResolvedWebhookUrl?: string;
};

type StartDaemonOptions = {
  projectUrl?: string;
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  defaultLlmModelName?: string;
  defaultLlmAgentName?: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: string;
  utilizationPercentageThreshold?: string;
  allowedIssueAuthors?: string;
  configFilePath: string;
};

type NotifyFinishedOptions = {
  issueUrl: string;
  projectUrl?: string;
  preparationStatus?: string;
  awaitingWorkspaceStatus?: string;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: string;
  workflowBlockerResolvedWebhookUrl?: string;
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
      defaultLlmModelName: getStringValue(parsed, 'defaultLlmModelName'),
      defaultLlmAgentName: getStringValue(parsed, 'defaultLlmAgentName'),
      logFilePath: getStringValue(parsed, 'logFilePath'),
      maximumPreparingIssuesCount: getNumberValue(
        parsed,
        'maximumPreparingIssuesCount',
      ),
      utilizationPercentageThreshold: getNumberValue(
        parsed,
        'utilizationPercentageThreshold',
      ),
      allowedIssueAuthors: getStringValue(parsed, 'allowedIssueAuthors'),
      awaitingQualityCheckStatus: getStringValue(
        parsed,
        'awaitingQualityCheckStatus',
      ),
      thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
      workflowBlockerResolvedWebhookUrl: getStringValue(
        parsed,
        'workflowBlockerResolvedWebhookUrl',
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to load configuration file "${configFilePath}": ${message}`,
    );
    process.exit(1);
  }
};

const parseProjectReadmeConfig = (readme: string): ConfigFile => {
  const detailsRegex =
    /<details>\s*<summary>config<\/summary>([\s\S]*?)<\/details>/i;
  const match = detailsRegex.exec(readme);
  if (!match) {
    return {};
  }
  const yamlContent = match[1].trim();
  if (!yamlContent) {
    return {};
  }
  try {
    const parsed: unknown = yaml.load(yamlContent);
    if (!isRecord(parsed)) {
      return {};
    }
    return {
      awaitingWorkspaceStatus: getStringValue(
        parsed,
        'awaitingWorkspaceStatus',
      ),
      preparationStatus: getStringValue(parsed, 'preparationStatus'),
      defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
      defaultLlmModelName: getStringValue(parsed, 'defaultLlmModelName'),
      defaultLlmAgentName: getStringValue(parsed, 'defaultLlmAgentName'),
      logFilePath: getStringValue(parsed, 'logFilePath'),
      maximumPreparingIssuesCount: getNumberValue(
        parsed,
        'maximumPreparingIssuesCount',
      ),
      utilizationPercentageThreshold: getNumberValue(
        parsed,
        'utilizationPercentageThreshold',
      ),
      allowedIssueAuthors: getStringValue(parsed, 'allowedIssueAuthors'),
      awaitingQualityCheckStatus: getStringValue(
        parsed,
        'awaitingQualityCheckStatus',
      ),
      thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
      workflowBlockerResolvedWebhookUrl: getStringValue(
        parsed,
        'workflowBlockerResolvedWebhookUrl',
      ),
    };
  } catch {
    console.warn('Failed to parse YAML from project README config section');
    return {};
  }
};

const mergeConfigs = (
  configFile: ConfigFile,
  cliOverrides: ConfigFile,
  readmeOverrides: ConfigFile,
): ConfigFile => ({
  projectUrl: cliOverrides.projectUrl ?? configFile.projectUrl,
  awaitingWorkspaceStatus:
    readmeOverrides.awaitingWorkspaceStatus ??
    cliOverrides.awaitingWorkspaceStatus ??
    configFile.awaitingWorkspaceStatus,
  preparationStatus:
    readmeOverrides.preparationStatus ??
    cliOverrides.preparationStatus ??
    configFile.preparationStatus,
  defaultAgentName:
    readmeOverrides.defaultAgentName ??
    cliOverrides.defaultAgentName ??
    configFile.defaultAgentName,
  defaultLlmModelName:
    readmeOverrides.defaultLlmModelName ??
    cliOverrides.defaultLlmModelName ??
    configFile.defaultLlmModelName,
  defaultLlmAgentName:
    readmeOverrides.defaultLlmAgentName ??
    cliOverrides.defaultLlmAgentName ??
    configFile.defaultLlmAgentName,
  logFilePath:
    readmeOverrides.logFilePath ??
    cliOverrides.logFilePath ??
    configFile.logFilePath,
  maximumPreparingIssuesCount:
    readmeOverrides.maximumPreparingIssuesCount ??
    cliOverrides.maximumPreparingIssuesCount ??
    configFile.maximumPreparingIssuesCount,
  utilizationPercentageThreshold:
    readmeOverrides.utilizationPercentageThreshold ??
    cliOverrides.utilizationPercentageThreshold ??
    configFile.utilizationPercentageThreshold,
  allowedIssueAuthors:
    readmeOverrides.allowedIssueAuthors ??
    cliOverrides.allowedIssueAuthors ??
    configFile.allowedIssueAuthors,
  awaitingQualityCheckStatus:
    readmeOverrides.awaitingQualityCheckStatus ??
    cliOverrides.awaitingQualityCheckStatus ??
    configFile.awaitingQualityCheckStatus,
  thresholdForAutoReject:
    readmeOverrides.thresholdForAutoReject ??
    cliOverrides.thresholdForAutoReject ??
    configFile.thresholdForAutoReject,
  workflowBlockerResolvedWebhookUrl:
    readmeOverrides.workflowBlockerResolvedWebhookUrl ??
    cliOverrides.workflowBlockerResolvedWebhookUrl ??
    configFile.workflowBlockerResolvedWebhookUrl,
});

const fetchProjectReadme = async (
  projectUrl: string,
  token: string,
): Promise<string | null> => {
  try {
    const graphqlProjectRepository = new GraphqlProjectRepository(token);
    return await graphqlProjectRepository.fetchReadme(projectUrl);
  } catch {
    console.warn('Failed to fetch project README');
    return null;
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
  .option('--defaultLlmModelName <name>', 'Default LLM model name')
  .option('--defaultLlmAgentName <name>', 'Default LLM agent name')
  .option('--logFilePath <path>', 'Path to log file')
  .option(
    '--maximumPreparingIssuesCount <count>',
    'Maximum number of issues in preparation status (default: 6)',
  )
  .option(
    '--utilizationPercentageThreshold <percentage>',
    'Claude usage percentage threshold for skipping preparation (default: 90)',
  )
  .option(
    '--allowedIssueAuthors <authors>',
    'Comma-separated list of allowed issue authors (default: all authors allowed)',
  )
  .action(async (options: StartDaemonOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const configFileValues = loadConfigFile(options.configFilePath);

    const cliOverrides: ConfigFile = {
      projectUrl: options.projectUrl,
      awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
      preparationStatus: options.preparationStatus,
      defaultAgentName: options.defaultAgentName,
      defaultLlmModelName: options.defaultLlmModelName,
      defaultLlmAgentName: options.defaultLlmAgentName,
      logFilePath: options.logFilePath,
      maximumPreparingIssuesCount: options.maximumPreparingIssuesCount
        ? Number(options.maximumPreparingIssuesCount)
        : undefined,
      utilizationPercentageThreshold: options.utilizationPercentageThreshold
        ? Number(options.utilizationPercentageThreshold)
        : undefined,
      allowedIssueAuthors: options.allowedIssueAuthors,
    };

    const tempProjectUrl =
      cliOverrides.projectUrl ?? configFileValues.projectUrl;

    let readmeOverrides: ConfigFile = {};
    if (tempProjectUrl) {
      const readme = await fetchProjectReadme(tempProjectUrl, token);
      if (readme) {
        readmeOverrides = parseProjectReadmeConfig(readme);
      }
    }

    const config = mergeConfigs(
      configFileValues,
      cliOverrides,
      readmeOverrides,
    );

    const projectUrl = config.projectUrl;
    const awaitingWorkspaceStatus = config.awaitingWorkspaceStatus;
    const preparationStatus = config.preparationStatus;
    const defaultAgentName = config.defaultAgentName;
    const defaultLlmModelName = config.defaultLlmModelName;
    const defaultLlmAgentName = config.defaultLlmAgentName;
    const logFilePath = config.logFilePath;

    if (!projectUrl) {
      console.error(
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
      );
      process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
      console.error(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.',
      );
      process.exit(1);
    }
    if (!preparationStatus) {
      console.error(
        'preparationStatus is required. Provide via --preparationStatus, config file, or project README.',
      );
      process.exit(1);
    }
    if (!defaultAgentName) {
      console.error(
        'defaultAgentName is required. Provide via --defaultAgentName, config file, or project README.',
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
    const rawMaxCount = config.maximumPreparingIssuesCount;
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
    const rawThreshold = config.utilizationPercentageThreshold;
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

    const rawAllowedAuthors = config.allowedIssueAuthors;
    const parsedAllowedIssueAuthors = rawAllowedAuthors
      ? rawAllowedAuthors
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a.length > 0)
      : null;
    const allowedIssueAuthors: string[] | null =
      parsedAllowedIssueAuthors && parsedAllowedIssueAuthors.length > 0
        ? parsedAllowedIssueAuthors
        : null;

    console.log(
      `maximumPreparingIssuesCount: ${maximumPreparingIssuesCount ?? 'null (default: 6)'}, utilizationPercentageThreshold: ${utilizationPercentageThreshold}`,
    );

    await useCase.run({
      projectUrl,
      awaitingWorkspaceStatus,
      preparationStatus,
      defaultAgentName,
      defaultLlmModelName: defaultLlmModelName ?? null,
      defaultLlmAgentName: defaultLlmAgentName ?? null,
      logFilePath: logFilePath ?? null,
      maximumPreparingIssuesCount,
      utilizationPercentageThreshold,
      allowedIssueAuthors,
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
    '--workflowBlockerResolvedWebhookUrl <url>',
    'Webhook URL to notify when a workflow blocker issue status changes to awaiting quality check. Supports {URL} and {MESSAGE} placeholders.',
  )
  .action(async (options: NotifyFinishedOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const configFileValues = loadConfigFile(options.configFilePath);

    const cliOverrides: ConfigFile = {
      projectUrl: options.projectUrl,
      preparationStatus: options.preparationStatus,
      awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
      awaitingQualityCheckStatus: options.awaitingQualityCheckStatus,
      thresholdForAutoReject: options.thresholdForAutoReject
        ? Number(options.thresholdForAutoReject)
        : undefined,
      workflowBlockerResolvedWebhookUrl:
        options.workflowBlockerResolvedWebhookUrl,
    };

    const tempProjectUrl =
      cliOverrides.projectUrl ?? configFileValues.projectUrl;

    let readmeOverrides: ConfigFile = {};
    if (tempProjectUrl) {
      const readme = await fetchProjectReadme(tempProjectUrl, token);
      if (readme) {
        readmeOverrides = parseProjectReadmeConfig(readme);
      }
    }

    const config = mergeConfigs(
      configFileValues,
      cliOverrides,
      readmeOverrides,
    );

    const projectUrl = config.projectUrl;
    const preparationStatus = config.preparationStatus;
    const awaitingWorkspaceStatus = config.awaitingWorkspaceStatus;
    const awaitingQualityCheckStatus = config.awaitingQualityCheckStatus;

    if (!projectUrl) {
      console.error(
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
      );
      process.exit(1);
    }
    if (!preparationStatus) {
      console.error(
        'preparationStatus is required. Provide via --preparationStatus, config file, or project README.',
      );
      process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
      console.error(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.',
      );
      process.exit(1);
    }
    if (!awaitingQualityCheckStatus) {
      console.error(
        'awaitingQualityCheckStatus is required. Provide via --awaitingQualityCheckStatus, config file, or project README.',
      );
      process.exit(1);
    }

    const workflowBlockerResolvedWebhookUrl: string | null =
      config.workflowBlockerResolvedWebhookUrl ?? null;

    const projectRepository = new TowerDefenceProjectRepository(
      options.configFilePath,
      token,
    );
    const towerDefenceIssueRepository = new TowerDefenceIssueRepository(
      options.configFilePath,
      token,
    );
    const graphqlIssueRepository = new GraphqlIssueRepository(token);
    const issueCommentRepository = new GitHubIssueCommentRepository(token);
    const webhookRepository = new FetchWebhookRepository();

    const useCase = new NotifyFinishedIssuePreparationUseCase(
      projectRepository,
      {
        get: graphqlIssueRepository.get.bind(graphqlIssueRepository),
        update: graphqlIssueRepository.update.bind(graphqlIssueRepository),
        findRelatedOpenPRs: graphqlIssueRepository.findRelatedOpenPRs.bind(
          graphqlIssueRepository,
        ),
        getStoryObjectMap: towerDefenceIssueRepository.getStoryObjectMap.bind(
          towerDefenceIssueRepository,
        ),
      },
      issueCommentRepository,
      webhookRepository,
    );

    let thresholdForAutoReject = 3;
    const rawThreshold = config.thresholdForAutoReject;
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

    await useCase.run({
      projectUrl,
      issueUrl: options.issueUrl,
      preparationStatus,
      awaitingWorkspaceStatus,
      awaitingQualityCheckStatus,
      thresholdForAutoReject,
      workflowBlockerResolvedWebhookUrl,
    });
  });

/* istanbul ignore next */
if (process.argv && require.main === module) {
  program.parse(process.argv);
}

export { program, loadConfigFile, parseProjectReadmeConfig, mergeConfigs };
