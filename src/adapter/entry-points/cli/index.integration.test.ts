import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { TowerDefenceIssueRepository } from '../../repositories/TowerDefenceIssueRepository';

dotenv.config();

describe('index', () => {
  const token = process.env.GH_TOKEN;
  const projectUrl = 'https://github.com/users/HiromiShikata/projects/49';
  const startDaemonIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1552';
  const notifyFinishedIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1557';

  const configFilePath = path.join(__dirname, 'test-config.yml');

  beforeAll(() => {
    const configContent = `org: 'HiromiShikata'
projectUrl: '${projectUrl}'
projectName: 'test-project'
manager: 'HiromiShikata'
allowIssueCacheMinutes: 0
credentials:
  ghToken: '${process.env.GH_TOKEN || ''}'
workingReport:
  repo: 'test-repository'
  members:
    - 'HiromiShikata'
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test'
  reportIssueLabels:
    - 'report'
`;
    fs.writeFileSync(configFilePath, configContent);
  });

  afterAll(() => {
    if (fs.existsSync(configFilePath)) {
      fs.unlinkSync(configFilePath);
    }
  });

  describe('startDaemon', () => {
    beforeAll(async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const issueRepository = new TowerDefenceIssueRepository(
        configFilePath,
        token,
      );

      const issue = await issueRepository.get(startDaemonIssueUrl, projectUrl);
      if (!issue) {
        throw new Error('Failed to get issue');
      }
      issue.status = 'Awaiting workspace';
      await issueRepository.update(issue, projectUrl);
    }, 60000);

    afterAll(async () => {
      if (!token) {
        return;
      }

      const issueRepository = new TowerDefenceIssueRepository(
        configFilePath,
        token,
      );

      const issue = await issueRepository.get(startDaemonIssueUrl, projectUrl);
      if (!issue) {
        return;
      }
      issue.status = 'Awaiting workspace';
      await issueRepository.update(issue, projectUrl);
    });

    it('success', async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const issueRepository = new TowerDefenceIssueRepository(
        configFilePath,
        token,
      );

      const beforeIssue = await issueRepository.get(
        startDaemonIssueUrl,
        projectUrl,
      );
      expect(beforeIssue?.status).toBe('Awaiting workspace');

      const result = execSync(
        `npx ts-node ./src/adapter/entry-points/cli/index.ts startDaemon --projectUrl ${projectUrl} --awaitingWorkspaceStatus "Awaiting workspace" --preparationStatus "Preparation" --defaultAgentName "impl" --configFilePath ${configFilePath}`,
        { encoding: 'utf-8', timeout: 600000 },
      );
      expect(result).toBeDefined();

      const afterIssue = await issueRepository.get(
        startDaemonIssueUrl,
        projectUrl,
      );
      expect(afterIssue?.status).toBe('Preparation');
    }, 600000);
  });

  describe('notifyFinishedIssuePreparation', () => {
    beforeAll(async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const issueRepository = new TowerDefenceIssueRepository(
        configFilePath,
        token,
      );

      const issue = await issueRepository.get(
        notifyFinishedIssueUrl,
        projectUrl,
      );
      if (!issue) {
        throw new Error('Failed to get issue');
      }
      issue.status = 'Preparation';
      await issueRepository.update(issue, projectUrl);
    }, 60000);

    afterAll(async () => {
      if (!token) {
        return;
      }

      const issueRepository = new TowerDefenceIssueRepository(
        configFilePath,
        token,
      );

      const issue = await issueRepository.get(
        notifyFinishedIssueUrl,
        projectUrl,
      );
      if (!issue) {
        return;
      }
      issue.status = 'Preparation';
      await issueRepository.update(issue, projectUrl);
    });

    it('success', async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const issueRepository = new TowerDefenceIssueRepository(
        configFilePath,
        token,
      );

      const beforeIssue = await issueRepository.get(
        notifyFinishedIssueUrl,
        projectUrl,
      );
      expect(beforeIssue?.status).toBe('Preparation');

      const result = execSync(
        `npx ts-node ./src/adapter/entry-points/cli/index.ts notifyFinishedIssuePreparation --projectUrl ${projectUrl} --issueUrl ${notifyFinishedIssueUrl} --preparationStatus "Preparation" --awaitingQualityCheckStatus "Awaiting quality check" --configFilePath ${configFilePath}`,
        { encoding: 'utf-8', timeout: 600000 },
      );
      expect(result).toBeDefined();

      const afterIssue = await issueRepository.get(
        notifyFinishedIssueUrl,
        projectUrl,
      );
      expect(afterIssue?.status).toBe('Awaiting quality check');
    }, 600000);
  });
});
