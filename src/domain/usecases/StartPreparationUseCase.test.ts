import { StartPreparationUseCase } from './StartPreparationUseCase';
import {
  IssueRepository,
  RelatedPullRequest,
} from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { Issue as TowerDefenceIssue } from 'github-issue-tower-defence-management';
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
  author: 'testuser',
  ...overrides,
});

const createMockProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  readme: null,
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
  let mockClaudeRepository: Mocked<Pick<ClaudeRepository, 'getUsage'>>;
  let mockLocalCommandRunner: Mocked<LocalCommandRunner>;
  let mockProject: Project;
  beforeEach(() => {
    jest.resetAllMocks();
    mockProject = createMockProject();
    mockProjectRepository = {
      getByUrl: jest.fn(),
      prepareStatus: jest
        .fn()
        .mockImplementation((_name: string, project: Project) =>
          Promise.resolve(project),
        ),
      prepareCustomNumberField: jest.fn(),
    };
    mockIssueRepository = {
      getAllOpened: jest.fn(),
      getStoryObjectMap: jest.fn().mockResolvedValue(new Map()),
      get: jest.fn(),
      update: jest.fn(),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
    };
    mockClaudeRepository = {
      getUsage: jest.fn().mockResolvedValue([]),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
    };
    useCase = new StartPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockClaudeRepository,
      mockLocalCommandRunner,
    );
  });
  it('should call prepareStatus for awaitingWorkspaceStatus and preparationStatus with chained project objects', async () => {
    const projectAfterFirstPrepare = createMockProject();
    const projectAfterSecondPrepare = createMockProject();
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockProjectRepository.prepareStatus
      .mockResolvedValueOnce(projectAfterFirstPrepare)
      .mockResolvedValueOnce(projectAfterSecondPrepare);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    expect(mockProjectRepository.prepareStatus).toHaveBeenCalledTimes(2);
    expect(mockProjectRepository.prepareStatus).toHaveBeenNthCalledWith(
      1,
      'Awaiting Workspace',
      mockProject,
    );
    expect(mockProjectRepository.prepareStatus).toHaveBeenNthCalledWith(
      2,
      'Preparation',
      projectAfterFirstPrepare,
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
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'url1',
      status: 'Preparation',
    });
    expect(mockIssueRepository.update.mock.calls[0][1]).toBe(mockProject);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl claude-opus ${mockProject.url}`,
    );
  });
  it('should pass --branch to aw command when issue has an existing linked PR', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    const existingPR: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/42',
      branchName: 'i1',
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([existingPR]);
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
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl claude-opus ${mockProject.url} --branch i1`,
    );
  });
  it('should pass --branch with PR branch name when issue URL is a PR URL', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'https://github.com/user/repo/pull/354',
        title: 'PR 354',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/user/repo/pull/354',
      branchName: 'dependabot/npm_and_yarn/multi-cc382f683c',
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
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
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw https://github.com/user/repo/pull/354 impl claude-opus ${mockProject.url} --branch dependabot/npm_and_yarn/multi-cc382f683c`,
    );
    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
      'https://github.com/user/repo/pull/354',
    );
  });
  it('should not pass --branch when issue has multiple linked PRs', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    const pr1: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/42',
      branchName: 'i1',
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    const pr2: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/43',
      branchName: 'i1-fix',
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([pr1, pr2]);
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
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl claude-opus ${mockProject.url}`,
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    // Both awaiting issues should be updated (forward iteration: url1 first, then url2)
    expect(mockIssueRepository.update.mock.calls).toHaveLength(2);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'url1',
      status: 'Preparation',
    });
    expect(mockIssueRepository.update.mock.calls[1][0]).toMatchObject({
      url: 'url2',
      status: 'Preparation',
    });
    expect(mockIssueRepository.update.mock.calls[0][1]).toBe(mockProject);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });
  it('should stop assigning after maximum preparing issues count is reached', async () => {
    // When we already have 6 preparation issues and max is 6 (default),
    // the loop condition prevents processing any new issues
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    // Loop doesn't run because we're already at max (6 >= 6)
    expect(mockIssueRepository.update.mock.calls).toHaveLength(0);
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
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      logFilePath: '/path/to/log.txt',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl claude-opus ${mockProject.url} --logFilePath /path/to/log.txt`,
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
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl claude-opus ${mockProject.url}`,
    );
  });
  it('should use llm-agent label over category label and defaultLlmAgentName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['llm-agent:research', 'category:impl'],
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
      defaultLlmModelName: null,
      defaultLlmAgentName: 'default-llm-agent',
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 research ${mockProject.url}`,
    );
  });
  it('should use category label over defaultLlmAgentName when no llm-agent label', async () => {
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
      defaultLlmModelName: null,
      defaultLlmAgentName: 'default-llm-agent',
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl ${mockProject.url}`,
    );
  });
  it('should use defaultLlmAgentName over defaultAgentName when no label', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
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
      defaultLlmModelName: null,
      defaultLlmAgentName: 'default-llm-agent',
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 default-llm-agent ${mockProject.url}`,
    );
  });
  it('should use llm-model label over defaultLlmModelName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl', 'llm-model:claude-sonnet'],
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
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      `aw url1 impl claude-sonnet ${mockProject.url}`,
    );
  });
  it('should omit model argument when no llm-model label and no defaultLlmModelName', async () => {
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: 3,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });
    expect(mockIssueRepository.update.mock.calls).toHaveLength(6);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(6);
  });

  it('should not skip issues from repositories with workflow blockers', async () => {
    const blockerIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/100',
      title: 'Blocker Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    const issueInBlockedRepo = createMockIssue({
      url: 'https://github.com/user/repo/issues/101',
      title: 'Issue in blocked repo',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

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
      issues: [issueInBlockedRepo],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(workflowBlockerMap);
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([
      blockerIssue,
      issueInBlockedRepo,
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(2);
    const updatedUrls = mockIssueRepository.update.mock.calls.map(
      (call) => call[0].url,
    );
    expect(updatedUrls).toContain('https://github.com/user/repo/issues/100');
    expect(updatedUrls).toContain('https://github.com/user/repo/issues/101');
  });

  it('should skip preparation when Claude usage is over 90%', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 95, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockProjectRepository.getByUrl).not.toHaveBeenCalled();
  });

  it('should proceed with preparation when Claude usage is under 90%', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 30, resetsAt: new Date() },
    ]);

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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should reduce maximumPreparingIssuesCount gradually when weekly usage window exceeds threshold', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 91, resetsAt: new Date() },
    ]);

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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    const weeklyUtilization = 91;
    const threshold = 90;
    const defaultMax = 6;
    const normalizedUtilizationBeyondThreshold =
      (weeklyUtilization - threshold) / (100 - threshold);
    const expectedMax = Math.floor(
      defaultMax * Math.pow(1 - normalizedUtilizationBeyondThreshold, 2),
    );
    expect(mockProjectRepository.getByUrl).toHaveBeenCalled();
    expect(mockIssueRepository.update.mock.calls).toHaveLength(expectedMax);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(
      expectedMax,
    );
  });

  it('should skip all preparation when weekly window usage reduces maximumPreparingIssuesCount to 0', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 168, utilizationPercentage: 100, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });

  it('should not apply weekly reduction when threshold is 100', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 168, utilizationPercentage: 99, resetsAt: new Date() },
    ]);

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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 100,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(6);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(6);
  });

  it('should still skip immediately when non-weekly window exceeds threshold', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 95, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 50, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    expect(mockProjectRepository.getByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.update.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });

  it('should use maximum utilization across multiple weekly window entries for reduction', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 168, utilizationPercentage: 91, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 95, resetsAt: new Date() },
    ]);

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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    const normalizedUtilizationBeyondThreshold = (95 - 90) / (100 - 90);
    const expectedMax = Math.floor(
      6 * Math.pow(1 - normalizedUtilizationBeyondThreshold, 2),
    );
    expect(mockIssueRepository.update.mock.calls).toHaveLength(expectedMax);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(
      expectedMax,
    );
  });

  it('should throw error when Claude usage check fails', async () => {
    mockClaudeRepository.getUsage.mockRejectedValue(
      new Error('Claude credentials file not found'),
    );

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        preparationStatus: 'Preparation',
        defaultAgentName: 'agent1',
        defaultLlmModelName: null,
        defaultLlmAgentName: null,
        logFilePath: null,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
      }),
    ).rejects.toThrow('Claude credentials file not found');

    expect(mockIssueRepository.update.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });

  it('should skip preparation when Claude usage exceeds custom threshold', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 75, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce(awaitingIssues);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 70,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockProjectRepository.getByUrl).not.toHaveBeenCalled();
  });

  it('should proceed with preparation when Claude usage is under custom threshold', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 75, resetsAt: new Date() },
    ]);

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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 80,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should skip issues that have dependedIssueUrls', async () => {
    const issueWithDependency = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Issue with dependency',
      labels: [],
      status: 'Awaiting Workspace',
      dependedIssueUrls: ['https://github.com/user/repo/issues/2'],
    });
    const issueWithoutDependency = createMockIssue({
      url: 'https://github.com/user/repo/issues/3',
      title: 'Issue without dependency',
      labels: [],
      status: 'Awaiting Workspace',
      dependedIssueUrls: [],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([issueWithDependency, issueWithoutDependency]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([
      issueWithDependency,
      issueWithoutDependency,
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'https://github.com/user/repo/issues/3',
      status: 'Preparation',
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should skip issues where nextActionHour is in the future', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-01T10:00:00'));

      const issueWithFutureNextActionHour = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with future next action hour',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionHour: 15,
      });
      const issueWithoutNextActionHour = createMockIssue({
        url: 'https://github.com/user/repo/issues/2',
        title: 'Issue without next action hour',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionHour: null,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([
          issueWithFutureNextActionHour,
          issueWithoutNextActionHour,
        ]),
      );
      mockIssueRepository.getAllOpened.mockResolvedValueOnce([
        issueWithFutureNextActionHour,
        issueWithoutNextActionHour,
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
        defaultLlmModelName: null,
        defaultLlmAgentName: null,
        logFilePath: null,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
        url: 'https://github.com/user/repo/issues/2',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should skip issues where nextActionDate is tomorrow or more future', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-15T10:00:00'));

      const issueWithFutureNextActionDate = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with future next action date',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionDate: new Date('2024-01-16'),
      });
      const issueWithoutNextActionDate = createMockIssue({
        url: 'https://github.com/user/repo/issues/2',
        title: 'Issue without next action date',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionDate: null,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([
          issueWithFutureNextActionDate,
          issueWithoutNextActionDate,
        ]),
      );
      mockIssueRepository.getAllOpened.mockResolvedValueOnce([
        issueWithFutureNextActionDate,
        issueWithoutNextActionDate,
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
        defaultLlmModelName: null,
        defaultLlmAgentName: null,
        logFilePath: null,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
        url: 'https://github.com/user/repo/issues/2',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should not skip issues where nextActionDate is today', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-15T10:00:00'));

      const issueWithTodayNextActionDate = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with today next action date',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionDate: new Date('2024-01-15'),
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([issueWithTodayNextActionDate]),
      );
      mockIssueRepository.getAllOpened.mockResolvedValueOnce([
        issueWithTodayNextActionDate,
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
        defaultLlmModelName: null,
        defaultLlmAgentName: null,
        logFilePath: null,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should not skip issues where nextActionDate is in the past', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-15T10:00:00'));

      const issueWithPastNextActionDate = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with past next action date',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionDate: new Date('2024-01-14'),
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([issueWithPastNextActionDate]),
      );
      mockIssueRepository.getAllOpened.mockResolvedValueOnce([
        issueWithPastNextActionDate,
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
        defaultLlmModelName: null,
        defaultLlmAgentName: null,
        logFilePath: null,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should not skip issues where nextActionHour is in the past or current hour', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-01T15:00:00'));

      const issueWithPastNextActionHour = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with past next action hour',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionHour: 10,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([issueWithPastNextActionHour]),
      );
      mockIssueRepository.getAllOpened.mockResolvedValueOnce([
        issueWithPastNextActionHour,
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
        defaultLlmModelName: null,
        defaultLlmAgentName: null,
        logFilePath: null,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should skip issues from non-allowed authors', async () => {
    const issueFromAllowedAuthor = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Issue from allowed author',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user1',
    });
    const issueFromNonAllowedAuthor = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      title: 'Issue from non-allowed author',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user3',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([
        issueFromAllowedAuthor,
        issueFromNonAllowedAuthor,
      ]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([
      issueFromAllowedAuthor,
      issueFromNonAllowedAuthor,
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['user1', 'user2'],
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should process all issues when allowedIssueAuthors is null', async () => {
    const issue1 = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Issue 1',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user1',
    });
    const issue2 = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      title: 'Issue 2',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user2',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([issue1, issue2]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([issue1, issue2]);
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(2);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });

  it('should not skip issues with empty author (tower defence issues)', async () => {
    const towerDefenceIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Tower defence issue',
      labels: [],
      status: 'Awaiting Workspace',
      author: '',
    });
    const normalIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      title: 'Normal issue',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user1',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([towerDefenceIssue, normalIssue]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([
      towerDefenceIssue,
      normalIssue,
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['user1', 'user2'],
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(2);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });

  it('should not skip issues without author property when allowedIssueAuthors is set', async () => {
    const issueWithoutAuthor: TowerDefenceIssue = {
      nameWithOwner: 'user/repo',
      number: 1,
      title: 'Issue without author property',
      state: 'OPEN',
      status: 'Awaiting Workspace',
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
    };

    const storyObjectMap: StoryObjectMap = new Map();
    storyObjectMap.set('Default Story', {
      story: {
        id: 'story-1',
        name: 'Default Story',
        color: 'GRAY',
        description: '',
      },
      storyIssue: null,
      issues: [issueWithoutAuthor],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);
    mockIssueRepository.getAllOpened.mockResolvedValueOnce([]);
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
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      logFilePath: null,
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['user1'],
    });

    expect(mockIssueRepository.update.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });
});
