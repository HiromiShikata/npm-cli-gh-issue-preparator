import dotenv from 'dotenv';
import { GraphqlIssueRepository } from './GraphqlIssueRepository';
import { Project } from '../../domain/entities/Project';
import { Issue } from '../../domain/entities/Issue';

dotenv.config();

const createMockProject = (): Project => ({
  id: 'test-project-id',
  url: 'https://github.com/users/HiromiShikata/projects/49',
  databaseId: 49,
  name: 'test-project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

describe('GraphqlIssueRepository Integration Tests', () => {
  let repository: GraphqlIssueRepository;

  beforeAll(() => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      throw new Error('GH_TOKEN environment variable is required');
    }
    repository = new GraphqlIssueRepository(token);
  });

  describe('update', () => {
    it('should update issue status and verify the change', async () => {
      const project = createMockProject();
      const issueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/1552';

      const originalIssue = await repository.get(issueUrl, project);
      expect(originalIssue).not.toBeNull();
      if (!originalIssue) {
        throw new Error('Original issue is null');
      }

      const originalStatus = originalIssue.status;
      // Use statuses that exist in the project (note: lowercase 'w' in 'workspace')
      const newStatus =
        originalStatus === 'Awaiting workspace'
          ? 'Preparation'
          : 'Awaiting workspace';

      const updatedIssue: Issue = {
        ...originalIssue,
        status: newStatus,
      };

      await repository.update(updatedIssue, project);

      const verifyIssue = await repository.get(issueUrl, project);
      expect(verifyIssue).not.toBeNull();
      expect(verifyIssue?.status).toBe(newStatus);

      const revertedIssue: Issue = {
        ...originalIssue,
        status: originalStatus,
      };
      await repository.update(revertedIssue, project);
    });

    it('should throw error when status option not found', async () => {
      const project = createMockProject();
      const issueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/1552';

      const originalIssue = await repository.get(issueUrl, project);
      expect(originalIssue).not.toBeNull();
      if (!originalIssue) {
        throw new Error('Original issue is null');
      }

      const invalidIssue: Issue = {
        ...originalIssue,
        status: 'NonExistentStatusXYZ123',
      };

      await expect(repository.update(invalidIssue, project)).rejects.toThrow(
        'Status option not found for status: NonExistentStatusXYZ123',
      );
    });
  });

  describe('get', () => {
    it('should return issue data from GitHub', async () => {
      const result = await repository.get(
        'https://github.com/HiromiShikata/test-repository/issues/1552',
        createMockProject(),
      );

      expect(result).not.toBeNull();
      expect(result?.url).toBe(
        'https://github.com/HiromiShikata/test-repository/issues/1552',
      );
      expect(result?.number).toBe(1552);
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('body');
    });

    it('should return null for non-existent issue', async () => {
      const result = await repository.get(
        'https://github.com/HiromiShikata/test-repository/issues/99999999',
        createMockProject(),
      );

      expect(result).toBeNull();
    });
  });

  describe('findRelatedOpenPRs', () => {
    it('should return related open PRs for issue with PR', async () => {
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/1552',
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toHaveProperty('url');
      expect(result[0]).toHaveProperty('isConflicted');
      expect(result[0]).toHaveProperty('isPassedAllCiJob');
      expect(result[0]).toHaveProperty('isResolvedAllReviewComments');
      expect(result[0]).toHaveProperty('isBranchOutOfDate');
    });

    it('should return empty array for issue with no PR', async () => {
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/1901',
      );

      expect(result).toHaveLength(0);
    });

    it('should return PRs for issue with PRs', async () => {
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/1902',
      );

      // Issue 1902 has PRs linked to it - at least 1 should be returned
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return only open PRs for issue with 1 open PR and 1 closed PR', async () => {
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/1903',
      );

      expect(result).toHaveLength(1);
    });

    it('should return isPassedAllCiJob as true for issue with PR that has passed CI but is blocked by required review', async () => {
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/1967',
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((pr) => pr.isPassedAllCiJob === true)).toBe(true);
    });
  });
});
