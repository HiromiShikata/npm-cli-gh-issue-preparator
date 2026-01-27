import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { GitHubIssueRepository } from '../../repositories/GitHubIssueRepository';
import { GitHubProjectRepository } from '../../repositories/GitHubProjectRepository';

dotenv.config();

describe('index', () => {
  const token = process.env.GH_TOKEN;
  const projectUrl = 'https://github.com/users/HiromiShikata/projects/49';
  const startDaemonIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1552';
  const notifyFinishedIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1557';

  describe('startDaemon', () => {
    beforeAll(async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const issue = await issueRepository.get(startDaemonIssueUrl, project);
      if (!issue) {
        throw new Error('Failed to get issue');
      }
      issue.status = 'Awaiting workspace';
      await issueRepository.update(issue, project);
    }, 60000);

    afterAll(async () => {
      if (!token) {
        return;
      }

      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const issue = await issueRepository.get(startDaemonIssueUrl, project);
      if (!issue) {
        return;
      }
      issue.status = 'Awaiting workspace';
      await issueRepository.update(issue, project);
    });

    it('success', async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const beforeIssue = await issueRepository.get(
        startDaemonIssueUrl,
        project,
      );
      expect(beforeIssue?.status).toBe('Awaiting workspace');

      const result = execSync(
        'npx ts-node ./src/adapter/entry-points/cli/index.ts startDaemon --projectUrl https://github.com/users/HiromiShikata/projects/49 --awaitingWorkspaceStatus "Awaiting workspace" --preparationStatus "Preparation" --defaultAgentName "impl"',
        { encoding: 'utf-8', timeout: 600000 },
      );
      expect(result).toBeDefined();

      const afterIssue = await issueRepository.get(
        startDaemonIssueUrl,
        project,
      );
      expect(afterIssue?.status).toBe('Preparation');
    }, 600000);
  });

  describe('notifyFinishedIssuePreparation', () => {
    beforeAll(async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const issue = await issueRepository.get(notifyFinishedIssueUrl, project);
      if (!issue) {
        throw new Error('Failed to get issue');
      }
      issue.status = 'Preparation';
      await issueRepository.update(issue, project);
    }, 60000);

    afterAll(async () => {
      if (!token) {
        return;
      }

      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const issue = await issueRepository.get(notifyFinishedIssueUrl, project);
      if (!issue) {
        return;
      }
      issue.status = 'Preparation';
      await issueRepository.update(issue, project);
    });

    it('success', async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const beforeIssue = await issueRepository.get(
        notifyFinishedIssueUrl,
        project,
      );
      expect(beforeIssue?.status).toBe('Preparation');

      const result = execSync(
        'npx ts-node ./src/adapter/entry-points/cli/index.ts notifyFinishedIssuePreparation --projectUrl https://github.com/users/HiromiShikata/projects/49 --issueUrl https://github.com/HiromiShikata/test-repository/issues/1557 --preparationStatus "Preparation" --awaitingAutoQualityCheckStatus "In Progress" --awaitingQualityCheckStatus "Awaiting quality check" --commentCountThreshold 5',
        { encoding: 'utf-8', timeout: 600000 },
      );
      expect(result).toBeDefined();

      const afterIssue = await issueRepository.get(
        notifyFinishedIssueUrl,
        project,
      );
      expect(afterIssue?.status).toBe('In Progress');
    }, 600000);
  });
});
