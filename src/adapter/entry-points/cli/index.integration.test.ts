import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('index', () => {
  const projectUrl = 'https://github.com/users/HiromiShikata/projects/49';
  const notifyFinishedIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1557';

  const configFilePath = path.join(
    __dirname,
    '../../../../tmp/test-config.yml',
  );

  beforeAll(() => {
    const ghToken = process.env.GH_TOKEN || '';
    if (!ghToken) {
      throw new Error('GH_TOKEN environment variable is required');
    }
    const tmpDir = path.dirname(configFilePath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const configContent = `org: HiromiShikata
projectUrl: ${projectUrl}
projectName: test-project
manager: HiromiShikata
allowIssueCacheMinutes: 0
credentials:
  ghToken: ${ghToken}
  bot:
    github:
      token: ${ghToken}
workingReport:
  repo: test-repository
  members:
    - HiromiShikata
  spreadsheetUrl: https://docs.google.com/spreadsheets/d/test
  reportIssueLabels:
    - report
`;
    fs.writeFileSync(configFilePath, configContent);
  });

  afterAll(() => {
    if (fs.existsSync(configFilePath)) {
      fs.unlinkSync(configFilePath);
    }
  });

  describe('startDaemon', () => {
    it('executes without error', () => {
      const result = execSync(
        `npx ts-node ./src/adapter/entry-points/cli/index.ts startDaemon --projectUrl ${projectUrl} --awaitingWorkspaceStatus "Awaiting workspace" --preparationStatus "Preparation" --defaultAgentName "impl" --configFilePath ${configFilePath}`,
        { encoding: 'utf-8', timeout: 600000 },
      );
      expect(result).toBeDefined();
    }, 600000);
  });

  describe('notifyFinishedIssuePreparation', () => {
    it('executes without missing token error', () => {
      let errorMessage = '';

      try {
        execSync(
          `npx ts-node ./src/adapter/entry-points/cli/index.ts notifyFinishedIssuePreparation --projectUrl ${projectUrl} --issueUrl ${notifyFinishedIssueUrl} --preparationStatus "Preparation" --awaitingWorkspaceStatus "Awaiting workspace" --awaitingQualityCheckStatus "Awaiting quality check" --configFilePath ${configFilePath} 2>&1`,
          { encoding: 'utf-8', timeout: 600000 },
        );
      } catch (err) {
        if (
          err &&
          typeof err === 'object' &&
          'stdout' in err &&
          typeof err.stdout === 'string'
        ) {
          errorMessage = err.stdout;
        }
      }

      expect(errorMessage).not.toContain(
        'GH_TOKEN environment variable is required',
      );
      expect(errorMessage).not.toContain('Invalid input');
    }, 600000);
  });
});
