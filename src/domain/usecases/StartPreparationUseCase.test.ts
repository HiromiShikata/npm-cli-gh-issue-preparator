import { StartPreparationUseCase } from './StartPreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

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
      url: 'url2',
      status: 'Preparation',
    });
    expect(mockIssueRepository.update.mock.calls[0][1]).toBe(mockProject);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });
  it('should not assign workspace if maximum preparing issues reached', async () => {
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
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([
      ...preparationIssues,
      ...awaitingIssues,
    ]);
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
    });
    const issue7UpdateCalls = mockIssueRepository.update.mock.calls.filter(
      (call) => call[0].url === 'url7',
    );
    expect(issue7UpdateCalls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
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
  it('should handle defensive break when pop returns undefined', async () => {
    const awaitingIssue: Issue = createMockIssue({
      url: 'url1',
      title: 'Issue 1',
      labels: [],
      status: 'Awaiting Workspace',
    });
    let popCallCount = 0;
    const issuesWithMockedPop: Issue[] = [awaitingIssue, awaitingIssue];
    const mockedPop = jest.fn((): Issue | undefined => {
      popCallCount++;
      if (popCallCount === 1) {
        return awaitingIssue;
      }
      return undefined;
    });
    Object.defineProperty(issuesWithMockedPop, 'pop', { value: mockedPop });
    Object.defineProperty(issuesWithMockedPop, 'filter', {
      value: () => issuesWithMockedPop,
    });
    const allIssues: Issue[] = [];
    Object.defineProperty(allIssues, 'filter', {
      value: jest.fn(() => issuesWithMockedPop),
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(allIssues);
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
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
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
});
