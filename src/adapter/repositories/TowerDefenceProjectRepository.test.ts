import { TowerDefenceProjectRepository } from './TowerDefenceProjectRepository';
import { getStoryObjectMap } from 'github-issue-tower-defence-management';
import { Project } from '../../domain/entities/Project';

jest.mock('github-issue-tower-defence-management');

const createMockTowerDefenceProject = () => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 123,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      { id: '1', name: 'Backlog', color: 'GRAY' as const, description: '' },
      {
        id: '2',
        name: 'In Progress',
        color: 'YELLOW' as const,
        description: '',
      },
      { id: '3', name: 'Done', color: 'GREEN' as const, description: '' },
    ],
  },
  nextActionDate: {
    name: 'Next Action Date',
    fieldId: 'next-action-date-field-id',
  },
  nextActionHour: {
    name: 'Next Action Hour',
    fieldId: 'next-action-hour-field-id',
  },
  story: {
    name: 'Story',
    fieldId: 'story-field-id',
    databaseId: 456,
    stories: [
      { id: 's1', name: 'Story 1', color: 'BLUE' as const, description: '' },
    ],
    workflowManagementStory: {
      id: 'wf-story-1',
      name: 'Workflow Story',
    },
  },
  remainingEstimationMinutes: {
    name: 'Remaining Estimation',
    fieldId: 'remaining-estimation-field-id',
  },
  dependedIssueUrlSeparatedByComma: {
    name: 'Depended Issues',
    fieldId: 'depended-issues-field-id',
  },
  completionDate50PercentConfidence: {
    name: 'Completion Date',
    fieldId: 'completion-date-field-id',
  },
});

describe('TowerDefenceProjectRepository', () => {
  let repository: TowerDefenceProjectRepository;
  const mockGetStoryObjectMap = jest.mocked(getStoryObjectMap);

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TowerDefenceProjectRepository(
      '/path/to/config.yml',
      'test-token',
    );
  });

  describe('getByUrl', () => {
    it('should return project from tower defence library', async () => {
      const mockTowerDefenceProject = createMockTowerDefenceProject();
      mockGetStoryObjectMap.mockResolvedValue({
        project: mockTowerDefenceProject,
        issues: [],
        cacheUsed: false,
        storyObjectMap: new Map(),
      });

      const result = await repository.getByUrl(
        'https://github.com/users/user/projects/1',
      );

      expect(mockGetStoryObjectMap).toHaveBeenCalledWith(
        '/path/to/config.yml',
        false,
      );
      expect(result.id).toBe('project-1');
      expect(result.databaseId).toBe(123);
      expect(result.name).toBe('Test Project');
      expect(result.url).toBe('https://github.com/users/user/projects/1');
      expect(result.status.name).toBe('Status');
      expect(result.status.statuses).toHaveLength(3);
    });

    it('should cache project and not call library again', async () => {
      const mockTowerDefenceProject = createMockTowerDefenceProject();
      mockGetStoryObjectMap.mockResolvedValue({
        project: mockTowerDefenceProject,
        issues: [],
        cacheUsed: false,
        storyObjectMap: new Map(),
      });

      await repository.getByUrl('https://github.com/users/user/projects/1');
      await repository.getByUrl('https://github.com/users/user/projects/1');

      expect(mockGetStoryObjectMap).toHaveBeenCalledTimes(1);
    });

    it('should map all project fields correctly', async () => {
      const mockTowerDefenceProject = createMockTowerDefenceProject();
      mockGetStoryObjectMap.mockResolvedValue({
        project: mockTowerDefenceProject,
        issues: [],
        cacheUsed: false,
        storyObjectMap: new Map(),
      });

      const result = await repository.getByUrl(
        'https://github.com/users/user/projects/1',
      );

      expect(result.nextActionDate).toEqual({
        name: 'Next Action Date',
        fieldId: 'next-action-date-field-id',
      });
      expect(result.nextActionHour).toEqual({
        name: 'Next Action Hour',
        fieldId: 'next-action-hour-field-id',
      });
      expect(result.story).toEqual({
        name: 'Story',
        fieldId: 'story-field-id',
        databaseId: 456,
        stories: [
          { id: 's1', name: 'Story 1', color: 'BLUE', description: '' },
        ],
        workflowManagementStory: {
          id: 'wf-story-1',
          name: 'Workflow Story',
        },
      });
      expect(result.remainingEstimationMinutes).toEqual({
        name: 'Remaining Estimation',
        fieldId: 'remaining-estimation-field-id',
      });
      expect(result.dependedIssueUrlSeparatedByComma).toEqual({
        name: 'Depended Issues',
        fieldId: 'depended-issues-field-id',
      });
      expect(result.completionDate50PercentConfidence).toEqual({
        name: 'Completion Date',
        fieldId: 'completion-date-field-id',
      });
    });

    it('should handle project with null optional fields', async () => {
      const mockTowerDefenceProject = {
        ...createMockTowerDefenceProject(),
        nextActionDate: null,
        nextActionHour: null,
        story: null,
        remainingEstimationMinutes: null,
        dependedIssueUrlSeparatedByComma: null,
        completionDate50PercentConfidence: null,
      };
      mockGetStoryObjectMap.mockResolvedValue({
        project: mockTowerDefenceProject,
        issues: [],
        cacheUsed: false,
        storyObjectMap: new Map(),
      });

      const result = await repository.getByUrl(
        'https://github.com/users/user/projects/1',
      );

      expect(result.nextActionDate).toBeNull();
      expect(result.nextActionHour).toBeNull();
      expect(result.story).toBeNull();
      expect(result.remainingEstimationMinutes).toBeNull();
      expect(result.dependedIssueUrlSeparatedByComma).toBeNull();
      expect(result.completionDate50PercentConfidence).toBeNull();
    });
  });

  describe('prepareStatus', () => {
    it('should return the project unchanged', async () => {
      const mockProject: Project = {
        id: 'project-1',
        url: 'https://github.com/users/user/projects/1',
        databaseId: 123,
        name: 'Test Project',
        status: {
          name: 'Status',
          fieldId: 'status-field-id',
          statuses: [],
        },
        nextActionDate: null,
        nextActionHour: null,
        story: null,
        remainingEstimationMinutes: null,
        dependedIssueUrlSeparatedByComma: null,
        completionDate50PercentConfidence: null,
      };

      const result = await repository.prepareStatus('New Status', mockProject);

      expect(result).toBe(mockProject);
    });
  });

  describe('prepareCustomNumberField', () => {
    it('should return the project unchanged', async () => {
      const mockProject: Project = {
        id: 'project-1',
        url: 'https://github.com/users/user/projects/1',
        databaseId: 123,
        name: 'Test Project',
        status: {
          name: 'Status',
          fieldId: 'status-field-id',
          statuses: [],
        },
        nextActionDate: null,
        nextActionHour: null,
        story: null,
        remainingEstimationMinutes: null,
        dependedIssueUrlSeparatedByComma: null,
        completionDate50PercentConfidence: null,
      };

      const result = await repository.prepareCustomNumberField(
        'Custom Number',
        mockProject,
      );

      expect(result).toBe(mockProject);
    });
  });
});
