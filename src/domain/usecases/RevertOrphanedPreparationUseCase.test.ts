import { RevertOrphanedPreparationUseCase } from './RevertOrphanedPreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

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
      { id: '1', name: 'Awaiting workspace', color: 'GRAY', description: '' },
      { id: '2', name: 'Preparation', color: 'YELLOW', description: '' },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Preparation',
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

describe('RevertOrphanedPreparationUseCase', () => {
  let useCase: RevertOrphanedPreparationUseCase;
  let mockProjectRepository: Mocked<ProjectRepository>;
  let mockIssueRepository: Mocked<
    Pick<IssueRepository, 'getAllOpened' | 'update'>
  >;
  let mockIssueCommentRepository: Mocked<
    Pick<IssueCommentRepository, 'createComment'>
  >;
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
      update: jest.fn(),
    };
    mockIssueCommentRepository = {
      createComment: jest.fn(),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
    };
    useCase = new RevertOrphanedPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
      mockLocalCommandRunner,
    );
  });

  it('should call prepareStatus for preparationStatus and awaitingWorkspaceStatus', async () => {
    const projectAfterFirstPrepare = createMockProject();
    const projectAfterSecondPrepare = createMockProject();
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockProjectRepository.prepareStatus
      .mockResolvedValueOnce(projectAfterFirstPrepare)
      .mockResolvedValueOnce(projectAfterSecondPrepare);
    mockIssueRepository.getAllOpened.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting workspace',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockProjectRepository.prepareStatus).toHaveBeenCalledTimes(2);
    expect(mockProjectRepository.prepareStatus).toHaveBeenNthCalledWith(
      1,
      'Preparation',
      mockProject,
    );
    expect(mockProjectRepository.prepareStatus).toHaveBeenNthCalledWith(
      2,
      'Awaiting workspace',
      projectAfterFirstPrepare,
    );
  });

  it('should revert a stuck Preparation issue to Awaiting workspace when check command exits 1', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/42',
      status: 'Preparation',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([stuckIssue]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting workspace',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith(
      'pgrep -fa "claude-agent.*https://github.com/user/repo/issues/42"',
    );
    expect(mockIssueRepository.update).toHaveBeenCalledTimes(1);
    const updatedIssue = mockIssueRepository.update.mock.calls[0][0];
    expect(updatedIssue).toMatchObject({
      url: 'https://github.com/user/repo/issues/42',
      status: 'Awaiting workspace',
    });
    expect(mockIssueRepository.update.mock.calls[0][1]).toBe(mockProject);
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledTimes(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][0]).toEqual(
      updatedIssue,
    );
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Preparation',
    );
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Awaiting workspace',
    );
  });

  it('should skip and log when check command exits with unexpected code (not 0 or 1)', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/55',
      status: 'Preparation',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: 'pgrep: invalid option',
      exitCode: 2,
    });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting workspace',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.update).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
    consoleSpy.mockRestore();
  });

  it('should throw when preparationProcessCheckCommand does not contain {URL}', async () => {
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([]);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting workspace',
        preparationProcessCheckCommand: 'pgrep -fa claude-agent',
      }),
    ).rejects.toThrow('{URL}');
  });

  it('should replace all occurrences of {URL} in the command template', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/77',
      status: 'Preparation',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting workspace',
      preparationProcessCheckCommand: 'check {URL} && verify {URL}',
    });

    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith(
      'check https://github.com/user/repo/issues/77 && verify https://github.com/user/repo/issues/77',
    );
  });

  it('should propagate error when runCommand rejects', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/88',
      status: 'Preparation',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockLocalCommandRunner.runCommand.mockRejectedValue(
      new Error('spawn failed'),
    );

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting workspace',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      }),
    ).rejects.toThrow('spawn failed');
  });

  it('should leave an in-flight Preparation issue untouched when check command exits zero', async () => {
    const inFlightIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/99',
      status: 'Preparation',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([inFlightIssue]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: 'claude-agent process found',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting workspace',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith(
      'pgrep -fa "claude-agent.*https://github.com/user/repo/issues/99"',
    );
    expect(mockIssueRepository.update).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should only process issues in Preparation status and skip issues in other statuses', async () => {
    const preparationIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });
    const awaitingIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      status: 'Awaiting workspace',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      preparationIssue,
      awaitingIssue,
    ]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting workspace',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledTimes(1);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith(
      'pgrep -fa "claude-agent.*https://github.com/user/repo/issues/1"',
    );
    expect(mockIssueRepository.update).toHaveBeenCalledTimes(1);
  });

  it('should revert multiple orphaned Preparation issues independently', async () => {
    const orphan1 = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    const orphan2 = createMockIssue({
      url: 'https://github.com/user/repo/issues/20',
      status: 'Preparation',
    });
    const inFlight = createMockIssue({
      url: 'https://github.com/user/repo/issues/30',
      status: 'Preparation',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      orphan1,
      orphan2,
      inFlight,
    ]);
    mockLocalCommandRunner.runCommand
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 })
      .mockResolvedValueOnce({
        stdout: 'process running',
        stderr: '',
        exitCode: 0,
      });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting workspace',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.update).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.update.mock.calls[0][0]).toMatchObject({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Awaiting workspace',
    });
    expect(mockIssueRepository.update.mock.calls[1][0]).toMatchObject({
      url: 'https://github.com/user/repo/issues/20',
      status: 'Awaiting workspace',
    });
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledTimes(2);
  });

  it('should do nothing when there are no Preparation issues', async () => {
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      createMockIssue({ status: 'Awaiting workspace' }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting workspace',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockLocalCommandRunner.runCommand).not.toHaveBeenCalled();
    expect(mockIssueRepository.update).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });
});
