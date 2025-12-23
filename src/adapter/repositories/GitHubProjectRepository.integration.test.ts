/* eslint-disable no-type-assertion/no-type-assertion */
import dotenv from 'dotenv';
dotenv.config();

import { GitHubProjectRepository } from './GitHubProjectRepository';

describe('GitHubProjectRepository Integration Test', () => {
  const token = process.env.GH_TOKEN;
  const userProjectUrl = 'https://github.com/users/HiromiShikata/projects/49';

  describe('getByUrl', () => {
    it('should fetch user project data and verify structure', async () => {
      const repository = new GitHubProjectRepository(token as string);
      const project = await repository.getByUrl(userProjectUrl);

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(typeof project.id).toBe('string');
      expect(project.url).toBe(userProjectUrl);
      expect(project.name).toBeDefined();
      expect(typeof project.name).toBe('string');
      expect(Array.isArray(project.statuses)).toBe(true);
      expect(Array.isArray(project.customFieldNames)).toBe(true);
      expect(project.customFieldNames.length).toBeGreaterThan(0);
    }, 60000);

    it('should fetch user project and verify it has Status field', async () => {
      const repository = new GitHubProjectRepository(token as string);
      const project = await repository.getByUrl(userProjectUrl);

      expect(project.customFieldNames).toContain('Status');
      expect(project.statuses.length).toBeGreaterThan(0);
    }, 60000);

    it('should throw error for invalid project URL', async () => {
      const repository = new GitHubProjectRepository(token as string);
      const invalidUrl = 'https://github.com/invalid/url';

      await expect(repository.getByUrl(invalidUrl)).rejects.toThrow(
        'Invalid GitHub project URL',
      );
    }, 60000);

    it('should throw error for non-existent project', async () => {
      const repository = new GitHubProjectRepository(token as string);
      const nonExistentUrl =
        'https://github.com/users/HiromiShikata/projects/999999';

      await expect(repository.getByUrl(nonExistentUrl)).rejects.toThrow();
    }, 60000);
  });
});
