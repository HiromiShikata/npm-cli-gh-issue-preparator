import { TowerDefenceIssueRepository } from './TowerDefenceIssueRepository';
import {
  getStoryObjectMap,
  Issue,
  Project as TowerDefenceProject,
  StoryObjectMap,
} from 'github-issue-tower-defence-management';
import { Project } from '../../domain/entities/Project';

jest.mock('github-issue-tower-defence-management', () => ({
  getStoryObjectMap: jest.fn(),
}));

const mockedGetStoryObjectMap = jest.mocked(getStoryObjectMap);

const createMockTowerDefenceProject = (): TowerDefenceProject => ({
  id: 'proj-1',
  databaseId: 1,
  name: 'Test Project',
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

const createMockProject = (): Project => ({
  id: 'proj-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
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

const createMockStoryObjectMap = (): StoryObjectMap => new Map();

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Backlog',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  ...overrides,
});

describe('TowerDefenceIssueRepository', () => {
  let repository: TowerDefenceIssueRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TowerDefenceIssueRepository(
      '/path/to/config.yml',
      'test-token',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAllOpened', () => {
    it('should return only open issues', async () => {
      const mockIssues: Issue[] = [
        createMockIssue({
          url: 'https://github.com/user/repo/issues/1',
          state: 'OPEN',
        }),
        createMockIssue({
          url: 'https://github.com/user/repo/issues/2',
          state: 'CLOSED',
        }),
        createMockIssue({
          url: 'https://github.com/user/repo/issues/3',
          state: 'OPEN',
        }),
      ];

      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: mockIssues,
        cacheUsed: false,
        storyObjectMap: createMockStoryObjectMap(),
      });

      const result = await repository.getAllOpened(createMockProject());

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://github.com/user/repo/issues/1');
      expect(result[1].url).toBe('https://github.com/user/repo/issues/3');
    });

    it('should map author field when present on tower defence issue', async () => {
      const issueWithAuthor = {
        ...createMockIssue({ state: 'OPEN' }),
        author: 'someuser',
      };
      const mockIssues = [issueWithAuthor];

      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: mockIssues,
        cacheUsed: false,
        storyObjectMap: createMockStoryObjectMap(),
      });

      const result = await repository.getAllOpened(createMockProject());

      expect(result).toHaveLength(1);
      expect(result[0].author).toBe('someuser');
    });

    it('should default author to empty string when not present', async () => {
      const mockIssues: Issue[] = [createMockIssue({ state: 'OPEN' })];

      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: mockIssues,
        cacheUsed: false,
        storyObjectMap: createMockStoryObjectMap(),
      });

      const result = await repository.getAllOpened(createMockProject());

      expect(result).toHaveLength(1);
      expect(result[0].author).toBe('');
    });

    it('should use cached data on subsequent calls', async () => {
      const mockIssues: Issue[] = [createMockIssue({ state: 'OPEN' })];

      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: mockIssues,
        cacheUsed: false,
        storyObjectMap: createMockStoryObjectMap(),
      });

      await repository.getAllOpened(createMockProject());
      await repository.getAllOpened(createMockProject());

      expect(getStoryObjectMap).toHaveBeenCalledTimes(1);
    });
  });
});
