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

const createMockProject = (): Project => ({
  id: 'proj-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  readme: null,
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
  author: '',
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

    it('should retry on error and succeed when retry succeeds', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new TowerDefenceIssueRepository(
        '/path/to/config.yml',
        'test-token',
        [100],
        mockSleep,
      );

      const mockIssues: Issue[] = [createMockIssue({ state: 'OPEN' })];
      mockedGetStoryObjectMap
        .mockRejectedValueOnce(
          new TypeError(
            "Cannot read properties of undefined (reading 'organization')",
          ),
        )
        .mockResolvedValueOnce({
          project: createMockTowerDefenceProject(),
          issues: mockIssues,
          cacheUsed: false,
          storyObjectMap: createMockStoryObjectMap(),
        });

      const result = await retryRepository.getAllOpened(createMockProject());

      expect(result).toHaveLength(1);
      expect(getStoryObjectMap).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledTimes(1);
      expect(mockSleep).toHaveBeenCalledWith(100);
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should throw with clear error message after exhausting all retries', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new TowerDefenceIssueRepository(
        '/path/to/config.yml',
        'test-token',
        [100],
        mockSleep,
      );

      const originalError = new TypeError(
        "Cannot read properties of undefined (reading 'organization')",
      );
      mockedGetStoryObjectMap.mockRejectedValue(originalError);

      await expect(
        retryRepository.getAllOpened(createMockProject()),
      ).rejects.toThrow(
        "GitHub API error loading project data from /path/to/config.yml, all retries exhausted: Cannot read properties of undefined (reading 'organization')",
      );

      expect(getStoryObjectMap).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledTimes(1);
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should include non-Error thrown value in exhaustion error message', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new TowerDefenceIssueRepository(
        '/path/to/config.yml',
        'test-token',
        [100],
        mockSleep,
      );

      mockedGetStoryObjectMap.mockRejectedValue('non-error string failure');

      await expect(
        retryRepository.getAllOpened(createMockProject()),
      ).rejects.toThrow(
        'GitHub API error loading project data from /path/to/config.yml, all retries exhausted: non-error string failure',
      );

      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should immediately rethrow non-transient Error without retry', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new TowerDefenceIssueRepository(
        '/path/to/config.yml',
        'test-token',
        [100],
        mockSleep,
      );

      const nonTransientError = new Error('ENOENT: no such file or directory');
      mockedGetStoryObjectMap.mockRejectedValue(nonTransientError);

      await expect(
        retryRepository.getAllOpened(createMockProject()),
      ).rejects.toThrow('ENOENT: no such file or directory');

      expect(mockedGetStoryObjectMap).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should immediately rethrow TypeError not matching null/undefined property access', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockSleep = jest.fn().mockResolvedValue(undefined);
      const retryRepository = new TowerDefenceIssueRepository(
        '/path/to/config.yml',
        'test-token',
        [100],
        mockSleep,
      );

      const deterministicTypeError = new TypeError(
        'someFunction is not a function',
      );
      mockedGetStoryObjectMap.mockRejectedValue(deterministicTypeError);

      await expect(
        retryRepository.getAllOpened(createMockProject()),
      ).rejects.toThrow('someFunction is not a function');

      expect(mockedGetStoryObjectMap).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getStoryObjectMap', () => {
    it('should return story object map from tower defence library', async () => {
      const mockStoryObjectMap = createMockStoryObjectMap();
      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: [],
        cacheUsed: false,
        storyObjectMap: mockStoryObjectMap,
      });

      const result = await repository.getStoryObjectMap(createMockProject());

      expect(result).toBe(mockStoryObjectMap);
      expect(getStoryObjectMap).toHaveBeenCalledTimes(1);
    });

    it('should use cached data on subsequent calls', async () => {
      const mockStoryObjectMap = createMockStoryObjectMap();
      mockedGetStoryObjectMap.mockResolvedValue({
        project: createMockTowerDefenceProject(),
        issues: [],
        cacheUsed: false,
        storyObjectMap: mockStoryObjectMap,
      });

      await repository.getStoryObjectMap(createMockProject());
      await repository.getStoryObjectMap(createMockProject());

      expect(getStoryObjectMap).toHaveBeenCalledTimes(1);
    });
  });
});
