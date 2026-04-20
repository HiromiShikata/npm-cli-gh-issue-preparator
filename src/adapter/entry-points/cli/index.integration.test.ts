import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
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
awaitingWorkspaceStatus: "Awaiting workspace"
preparationStatus: "Preparation"
defaultAgentName: "impl"
awaitingQualityCheckStatus: "Awaiting quality check"
`;
    fs.writeFileSync(configFilePath, configContent);
  });

  afterAll(() => {
    if (fs.existsSync(configFilePath)) {
      fs.unlinkSync(configFilePath);
    }
  });

  describe('startDaemon', () => {
    it('logs all credentials at capacity and exits cleanly when no credentials exist', () => {
      const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'test-home-'));
      let threw = false;
      let output = '';
      try {
        output = execSync(
          `npx ts-node ./src/adapter/entry-points/cli/index.ts startDaemon --configFilePath ${configFilePath} 2>&1`,
          {
            encoding: 'utf-8',
            timeout: 600000,
            env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
          },
        );
      } catch (err) {
        threw = true;
        if (
          err &&
          typeof err === 'object' &&
          'stdout' in err &&
          typeof err.stdout === 'string'
        ) {
          output = err.stdout;
        }
        if (
          err &&
          typeof err === 'object' &&
          'stderr' in err &&
          typeof err.stderr === 'string'
        ) {
          output += err.stderr;
        }
      } finally {
        fs.rmSync(tmpHome, { recursive: true, force: true });
      }
      expect(threw).toBe(false);
      expect(output).toContain('Claude is unavailable: no configured credentials found or all credentials are at capacity');
    }, 600000);
  });

  describe('notifyFinishedIssuePreparation', () => {
    it('executes without missing token error', () => {
      let errorMessage = '';

      try {
        execSync(
          `npx ts-node ./src/adapter/entry-points/cli/index.ts notifyFinishedIssuePreparation --issueUrl ${notifyFinishedIssueUrl} --configFilePath ${configFilePath} 2>&1`,
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
