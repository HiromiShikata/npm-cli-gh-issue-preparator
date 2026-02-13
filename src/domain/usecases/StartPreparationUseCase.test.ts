import { StartPreparationUseCase } from './StartPreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockStoryObjectMap = (issues: Issue[]): StoryObjectMap => {
  const map: StoryObjectMap = new Map();
  map.set('Default Story', {
    story: {
      id: 'story-1',
      name: 'Default Story',
      color: 'GRAY',
      description: '',
    },
    storyIssue: null,
    issues: issues,
  });
  return map;
};

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

const createMockProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      { id: '1', name: 'Awaiting Workspace', color: 'GRAY', description: '' },
      { id: '2', name: 'Preparation', color: 'YELLOW', description: '' },
      { id: '3', name: 'Done', color: 'GREEN', description: '' },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

describe('StartPreparationUseCase', () => {
  let useCase: StartPreparationUseCase;
  let mockProjectRepository: Mocked<ProjectRepository>;
  let mockIssueRepository: Mocked<IssueRepository>;
  let mockLocalCommandRunner: Mocked<LocalCommandRunner>;
  let mockProject: Project;
  beforeEach(() => {
    jest.resetAllMocks();
    mockProject = createMockProject();
    mockProjectRepository = {
      getByUrl: jest.fn(),
      prepareStatus: jest.fn(),
    };
    mockIssueRepository = {
      getAllOpened: jest.fn(),
      getStoryObjectMap: jest.fn().mockResolvedValue(new Map()),
      get: jest.fn(),
      update: jest.fn(),
      findRelatedOpenPRs: jest.fn(),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
    };
    useCase = new StartPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockLocalCommandRunner,
    );
  });
  it('should run aw command for awaiting workspace issues', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });
    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'url1',
      status: 'Preparation',
    });
    expect(mockIssueRepository.update.mock.calls[0][1]).toBe(mockProject);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl ${mockProject.url}`,
    );
  });
  it('should assign workspace to awaiting issues', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
      createMockIssue({
        url: 'url2',
        title: 'Issue 2',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });
    // Both awaiting issues should be updated (pop returns url2 first, then url1)
    expect(mockIssueRepository.update.mock.calls).toHaveLength(2);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'url2',
      status: 'Preparation',
    });
    expect(mockIssueRepository.update.mock.calls[1][0]).toMatchObject({
      url: 'url1',
      status: 'Preparation',
    });
    expect(mockIssueRepository.update.mock.calls[0][1]).toBe(mockProject);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });
  it('should stop assigning after maximum preparing issues count is reached', async () => {
    // When we already have 6 preparation issues and max is 6, the loop will:
    // 1. Pop the awaiting issue
    // 2. Update it (count becomes 7)
    // 3. Check 7 >= 6, break
    // So 1 issue is updated before breaking
    const preparationIssues: Issue[] = Array.from({ length: 6 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Preparation',
      }),
    );
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url7',
        title: 'Issue 7',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([...preparationIssues, ...awaitingIssues]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([
      ...preparationIssues,
      ...awaitingIssues,
    ]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });
    // The loop updates the awaiting issue before checking the count
    const issue7UpdateCalls = mockIssueRepository.update.mock.calls.filter(
      (call) => call[0].url === 'url7',
    );
    expect(issue7UpdateCalls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });
  it('should append logFilePath to aw command when provided', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      logFilePath: '/path/to/log.txt',
      maximumPreparingIssuesCount: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl ${mockProject.url} --logFilePath /path/to/log.txt`,
    );
  });
  it('should not append logFilePath to aw command when not provided', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl ${mockProject.url}`,
    );
  });
  it('should handle no awaiting workspace issues gracefully', async () => {
    // Test that the loop handles an empty awaiting workspace issues array
    const preparationIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Preparation',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(preparationIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(preparationIssues);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });
    // No issues are in 'Awaiting Workspace' status, so no updates should happen
    expect(mockIssueRepository.update.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });
  it('should use custom maximumPreparingIssuesCount when provided', async () => {
    const awaitingIssues: Issue[] = Array.from({ length: 10 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: 3,
    });
    expect(mockIssueRepository.update.mock.calls).toHaveLength(3);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(3);
  });
  it('should use default maximumPreparingIssuesCount of 6 when null is provided', async () => {
    const awaitingIssues: Issue[] = Array.from({ length: 12 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });
    expect(mockIssueRepository.update.mock.calls).toHaveLength(6);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(6);
  });

  it('should skip issues from blocked repositories (not the blocker issue itself)', async () => {
    // Create a workflow blocker issue
    const blockerIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/100',
      title: 'Blocker Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    // Create an awaiting issue from the same repo
    const blockedIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/101',
      title: 'Blocked Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    // Create a storyObjectMap with a workflow blocker story
    const workflowBlockerMap: StoryObjectMap = new Map();
    workflowBlockerMap.set('Workflow blocker', {
      story: {
        id: 'story-blocker',
        name: 'Workflow blocker',
        color: 'RED',
        description: '',
      },
      storyIssue: null,
      issues: [blockerIssue],
    });
    workflowBlockerMap.set('Default Story', {
      story: {
        id: 'story-1',
        name: 'Default Story',
        color: 'GRAY',
        description: '',
      },
      storyIssue: null,
      issues: [blockedIssue],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(workflowBlockerMap);
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([
      blockerIssue,
      blockedIssue,
    ]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });

    // The blocked issue should be skipped (continue statement), but the blocker issue itself should be processed
    // Since pop() returns last element first, blockedIssue is popped first and skipped,
    // then blockerIssue is popped and processed
    const blockerUpdateCalls = mockIssueRepository.update.mock.calls.filter(
      (call) => call[0].url === 'https://github.com/user/repo/issues/100',
    );
    expect(blockerUpdateCalls).toHaveLength(1);
  });

  it('should process the blocker issue even when repository is blocked', async () => {
    // Create a workflow blocker issue
    const blockerIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/100',
      title: 'Blocker Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    // Create a storyObjectMap with a workflow blocker story
    const workflowBlockerMap2: StoryObjectMap = new Map();
    workflowBlockerMap2.set('Workflow blocker', {
      story: {
        id: 'story-blocker',
        name: 'Workflow blocker',
        color: 'RED',
        description: '',
      },
      storyIssue: null,
      issues: [blockerIssue],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      workflowBlockerMap2,
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([blockerIssue]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });

    // The blocker issue should be processed since it's the blocker itself
    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'https://github.com/user/repo/issues/100',
      status: 'Preparation',
    });
  });

  it('should handle workflow blocker story with undefined storyObject (|| [] fallback)', async () => {
    // Create an awaiting issue that should be processed
    const awaitingIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/101',
      title: 'Awaiting Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    // Create a custom Map that has a 'Workflow blocker' key but returns undefined for get()
    // This tests the || [] fallback branch
    const customMap: StoryObjectMap = new Map();
    customMap.set('Default Story', {
      story: {
        id: 'story-1',
        name: 'Default Story',
        color: 'GRAY',
        description: '',
      },
      storyIssue: null,
      issues: [awaitingIssue],
    });
    // Add the Workflow blocker key to the Map
    customMap.set('Workflow blocker', {
      story: {
        id: 'story-blocker',
        name: 'Workflow blocker',
        color: 'RED',
        description: '',
      },
      storyIssue: null,
      issues: [],
    });
    // Override the get method to return undefined for 'Workflow blocker' key
    const originalGet = customMap.get.bind(customMap);
    customMap.get = (key: string) => {
      if (key === 'Workflow blocker') {
        return undefined;
      }
      return originalGet(key);
    };

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(customMap);
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([awaitingIssue]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });

    // The awaiting issue should be processed since there are no blockers (undefined returned empty array [])
    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'https://github.com/user/repo/issues/101',
      status: 'Preparation',
    });
  });
});
