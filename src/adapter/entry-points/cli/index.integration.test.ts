import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { GitHubIssueRepository } from '../../repositories/GitHubIssueRepository';
import { GitHubProjectRepository } from '../../repositories/GitHubProjectRepository';
import { Issue } from '../../../domain/entities/Issue';

dotenv.config();

const getToken = (): string => {
  const token = process.env.GH_TOKEN;
  return token || '';
};

describe('index', () => {
  const projectUrl = 'https://github.com/users/HiromiShikata/projects/49';
  const startDaemonIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1552';
  const notifyFinishedIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1557';

  describe('startDaemon', () => {
    beforeAll(async () => {
      const token = getToken();
      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const issue = await issueRepository.get(startDaemonIssueUrl, project);
      const definedIssue: Issue = issue || {
        id: '',
        status: '',
        url: '',
        title: '',
        labels: [],
      };
      definedIssue.status = 'Awaiting workspace';
      await issueRepository.update(definedIssue, project);
    }, 60000);

    afterAll(async () => {
      const token = getToken();
      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const issue = await issueRepository.get(startDaemonIssueUrl, project);
      const definedIssue: Issue = issue || {
        id: '',
        status: '',
        url: '',
        title: '',
        labels: [],
      };
      definedIssue.status = 'Awaiting workspace';
      await issueRepository.update(definedIssue, project);
    });

    it('should start daemon and change status to Preparation', async () => {
      const token = getToken();
      expect(token).toBeTruthy();
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
      const token = getToken();
      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const issue = await issueRepository.get(notifyFinishedIssueUrl, project);
      const definedIssue: Issue = issue || {
        id: '',
        status: '',
        url: '',
        title: '',
        labels: [],
      };
      definedIssue.status = 'Preparation';
      await issueRepository.update(definedIssue, project);
    }, 60000);

    afterAll(async () => {
      const token = getToken();
      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const issue = await issueRepository.get(notifyFinishedIssueUrl, project);
      const definedIssue: Issue = issue || {
        id: '',
        status: '',
        url: '',
        title: '',
        labels: [],
      };
      definedIssue.status = 'Preparation';
      await issueRepository.update(definedIssue, project);
    });

    it('should notify finished preparation and change status', async () => {
      const token = getToken();
      expect(token).toBeTruthy();
      const issueRepository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const beforeIssue = await issueRepository.get(
        notifyFinishedIssueUrl,
        project,
      );
      expect(beforeIssue?.status).toBe('Preparation');

      const result = execSync(
        'npx ts-node ./src/adapter/entry-points/cli/index.ts notifyFinishedIssuePreparation --projectUrl https://github.com/users/HiromiShikata/projects/49 --issueUrl https://github.com/HiromiShikata/test-repository/issues/1557 --preparationStatus "Preparation" --awaitingQualityCheckStatus "Awaiting quality check"',
        { encoding: 'utf-8', timeout: 600000 },
      );
      expect(result).toBeDefined();

      const afterIssue = await issueRepository.get(
        notifyFinishedIssueUrl,
        project,
      );
      expect(afterIssue?.status).toBe('Awaiting quality check');
    }, 600000);
  });
});
