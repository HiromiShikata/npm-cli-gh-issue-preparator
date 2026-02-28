import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { Comment } from '../entities/Comment';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
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
  ...overrides,
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
  ...overrides,
});

const createMockComment = (overrides: Partial<Comment> = {}): Comment => ({
  author: 'test-user',
  content: 'From: Test comment',
  createdAt: new Date(),
  ...overrides,
});

describe('NotifyFinishedIssuePreparationUseCase', () => {
  let useCase: NotifyFinishedIssuePreparationUseCase;
  let mockProjectRepository: Mocked<ProjectRepository>;
  let mockIssueRepository: Mocked<IssueRepository>;
  let mockIssueCommentRepository: Mocked<IssueCommentRepository>;
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
    };

    mockIssueRepository = {
      getAllOpened: jest.fn(),
      getStoryObjectMap: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      findRelatedOpenPRs: jest.fn(),
    };

    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn(),
      createComment: jest.fn(),
    };

    useCase = new NotifyFinishedIssuePreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  it('should call prepareStatus for preparationStatus, awaitingWorkspaceStatus, and awaitingQualityCheckStatus with chained project objects', async () => {
    const projectAfterFirstPrepare = createMockProject();
    const projectAfterSecondPrepare = createMockProject();
    const projectAfterThirdPrepare = createMockProject();
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockProjectRepository.prepareStatus
      .mockResolvedValueOnce(projectAfterFirstPrepare)
      .mockResolvedValueOnce(projectAfterSecondPrepare)
      .mockResolvedValueOnce(projectAfterThirdPrepare);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockProjectRepository.prepareStatus).toHaveBeenCalledTimes(3);
    expect(mockProjectRepository.prepareStatus).toHaveBeenNthCalledWith(
      1,
      'Preparation',
      mockProject,
    );
    expect(mockProjectRepository.prepareStatus).toHaveBeenNthCalledWith(
      2,
      'Awaiting Workspace',
      projectAfterFirstPrepare,
    );
    expect(mockProjectRepository.prepareStatus).toHaveBeenNthCalledWith(
      3,
      'Awaiting Quality Check',
      projectAfterSecondPrepare,
    );
  });

  it('should update issue status from Preparation to Awaiting Quality Check when last comment starts with From:', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should throw IssueNotFoundError when issue does not exist', async () => {
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/999',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
      }),
    ).rejects.toThrow(
      'Issue not found: https://github.com/user/repo/issues/999',
    );
  });

  it('should throw IllegalIssueStatusError when issue status is not Preparation', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Done',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
      }),
    ).rejects.toThrow(
      'Illegal issue status for https://github.com/user/repo/issues/1: expected Preparation, but got Done',
    );
  });

  it('should reject and set status to Awaiting Workspace when last comment starts with Auto Status Check:', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'Auto Status Check: REJECTED\n["NO_REPORT"]',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
  });

  it('should reject when last comment does not start with From:', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Some other comment' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
    );
  });

  it('should reject and set status to Awaiting Workspace when no comments exist', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalled();
  });

  it('should auto-escalate to Awaiting Quality Check after threshold rejections', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - third' }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining(
        'Failed to pass the check autimatically for 3 times',
      ),
    );
  });

  it('should not auto-escalate when rejections are below threshold', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
  });

  it('should not auto-escalate when retry comment exists even if threshold met', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - third' }),
      createMockComment({ content: 'retry' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should handle case-insensitive retry comment', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - third' }),
      createMockComment({ content: 'Retry please' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should reject when PR is not found', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
    );
  });

  it('should reject when multiple PRs are found', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
      {
        url: 'https://github.com/user/repo/pull/2',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('MULTIPLE_PULL_REQUESTS_FOUND'),
    );
  });

  it('should reject when PR is conflicted', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: true,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('PULL_REQUEST_CONFLICTED'),
    );
  });

  it('should reject when CI job failed', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('ANY_CI_JOB_FAILED_OR_IN_PROGRESS'),
    );
  });

  it('should reject when review comments are not resolved', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: false,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('ANY_REVIEW_COMMENT_NOT_RESOLVED'),
    );
  });

  it('should skip PR checks and update to Awaiting Quality Check when issue has category label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['category:frontend'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should check PRs when issue has category:e2e label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['category:e2e'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalled();
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should still check for report comment even when issue has category label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['category:backend'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'Auto Status Check: REJECTED\n["NO_REPORT"]',
      }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
    );
  });
});
