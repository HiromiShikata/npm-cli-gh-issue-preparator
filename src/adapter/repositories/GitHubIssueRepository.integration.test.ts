import dotenv from 'dotenv';
dotenv.config();

import { GitHubIssueRepository } from './GitHubIssueRepository';
import { GitHubProjectRepository } from './GitHubProjectRepository';
import { Issue } from '../../domain/entities/Issue';

const getToken = (): string => {
  const token = process.env.GH_TOKEN;
  return token || '';
};

describe('GitHubIssueRepository Integration Test', () => {
  const projectUrl = 'https://github.com/users/HiromiShikata/projects/49';
  const issueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1552';

  describe('getgetAllOpened', () => {
    it('should get all opened issues and verify the list is not empty', async () => {
      const token = getToken();
      expect(token).toBeTruthy();
      const repository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const openedIssues = await repository.getAllOpened(project);
      expect(openedIssues.length).toBeGreaterThan(0);
    }, 60000);
  });
  describe('update', () => {
    it('should update issue status from Awaiting workspace to Preparation and verify the change', async () => {
      const token = getToken();
      expect(token).toBeTruthy();
      const repository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const initialIssue = await repository.get(issueUrl, project);
      expect(initialIssue).not.toBeNull();
      const definedInitialIssue: Issue = initialIssue || {
        id: '',
        status: '',
        url: '',
        title: '',
        labels: [],
      };

      definedInitialIssue.status = 'Awaiting workspace';
      await repository.update(definedInitialIssue, project);

      const reloadedIssue = await repository.get(issueUrl, project);
      expect(reloadedIssue).not.toBeNull();
      const definedReloadedIssue: Issue = reloadedIssue || {
        id: '',
        status: '',
        url: '',
        title: '',
        labels: [],
      };
      expect(definedReloadedIssue.status).toBe('Awaiting workspace');

      definedReloadedIssue.status = 'Preparation';
      await repository.update(definedReloadedIssue, project);

      const verifyIssue = await repository.get(issueUrl, project);
      expect(verifyIssue).not.toBeNull();
      const definedVerifyIssue: Issue = verifyIssue || {
        id: '',
        status: '',
        url: '',
        title: '',
        labels: [],
      };
      expect(definedVerifyIssue.status).toBe('Preparation');

      definedVerifyIssue.status = 'Awaiting workspace';
      await repository.update(definedVerifyIssue, project);
    }, 60000);
  });
});
