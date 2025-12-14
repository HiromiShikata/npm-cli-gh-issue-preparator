#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';
import { GitHubProjectRepository } from '../../repositories/GitHubProjectRepository';
import { GitHubIssueRepository } from '../../repositories/GitHubIssueRepository';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';

type StartDaemonOptions = {
  projectUrl: string;
  awaitingWorkspaceStatus: string;
  preparationStatus: string;
  defaultAgentName: string;
};

type NotifyFinishedOptions = {
  projectUrl: string;
  issueUrl: string;
  preparationStatus: string;
  awaitingQualityCheckStatus: string;
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
  .action(async (options: StartDaemonOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const projectRepository = new GitHubProjectRepository(token);
    const issueRepository = new GitHubIssueRepository(token);
    const localCommandRunner = new NodeLocalCommandRunner();

    const useCase = new StartPreparationUseCase(
      projectRepository,
      issueRepository,
      localCommandRunner,
    );

    await useCase.run({
      projectUrl: options.projectUrl,
      awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
      preparationStatus: options.preparationStatus,
      defaultAgentName: options.defaultAgentName,
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
    '--awaitingQualityCheckStatus <status>',
    'Status for issues awaiting quality check',
  )
  .action(async (options: NotifyFinishedOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const projectRepository = new GitHubProjectRepository(token);
    const issueRepository = new GitHubIssueRepository(token);

    const useCase = new NotifyFinishedIssuePreparationUseCase(
      projectRepository,
      issueRepository,
    );

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

export { program };
