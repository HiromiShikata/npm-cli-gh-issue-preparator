import dotenv from 'dotenv';
dotenv.config();

import { GitHubIssueRepository } from './GitHubIssueRepository';
import { GitHubProjectRepository } from './GitHubProjectRepository';

describe('GitHubIssueRepository Integration Test', () => {
  const token = process.env.GH_TOKEN;
  const projectUrl = 'https://github.com/users/HiromiShikata/projects/49';
  const issueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/1552';

  describe('getgetAllOpened', () => {
    it('should get all opened issues and verify the list is not empty', async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const repository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const openedIssues = await repository.getAllOpened(project);
      expect(openedIssues.length).toBeGreaterThan(0);
    }, 60000);
  });
  describe('update', () => {
    it('should update issue status from Awaiting workspace to Preparation and verify the change', async () => {
      if (!token) {
        throw new Error('GH_TOKEN environment variable is required');
      }

      const repository = new GitHubIssueRepository(token);
      const projectRepository = new GitHubProjectRepository(token);
      const project = await projectRepository.getByUrl(projectUrl);

      const initialIssue = await repository.get(issueUrl, project);
      expect(initialIssue).not.toBeNull();
      if (!initialIssue) {
        throw new Error('Failed to get initial issue');
      }

      initialIssue.status = 'Awaiting workspace';
      await repository.update(initialIssue, project);

      const reloadedIssue = await repository.get(issueUrl, project);
      if (!reloadedIssue) {
        throw new Error('Failed to get reloaded issue');
      }
      expect(reloadedIssue.status).toBe('Awaiting workspace');

      reloadedIssue.status = 'Preparation';
      await repository.update(reloadedIssue, project);

      const verifyIssue = await repository.get(issueUrl, project);
      expect(verifyIssue).not.toBeNull();
      if (!verifyIssue) {
        throw new Error('Failed to get verify issue');
      }
      expect(verifyIssue.status).toBe('Preparation');

      verifyIssue.status = 'Awaiting workspace';
      await repository.update(verifyIssue, project);
    }, 60000);
  });
});
