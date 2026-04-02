import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { WebhookRepository } from './adapter-interfaces/WebhookRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { Comment } from '../entities/Comment';
import { StoryObjectMap } from '../entities/StoryObjectMap';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
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
  author: 'testuser',
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
  let mockWebhookRepository: Mocked<WebhookRepository>;
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
      getStoryObjectMap: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      findRelatedOpenPRs: jest.fn(),
      getOpenPullRequest: jest.fn(),
    };

    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn(),
      createComment: jest.fn(),
    };

    mockWebhookRepository = {
      sendGetRequest: jest.fn(),
    };

    mockIssueRepository.getStoryObjectMap.mockResolvedValue(new Map());

    useCase = new NotifyFinishedIssuePreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
      mockWebhookRepository,
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
        workflowBlockerResolvedWebhookUrl: null,
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
        workflowBlockerResolvedWebhookUrl: null,
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
    const createCommentCall =
      mockIssueCommentRepository.createComment.mock.calls[0];
    expect(createCommentCall[0]).toEqual(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
    );
    expect(createCommentCall[1]).toContain('Auto Status Check:');
    expect(createCommentCall[1]).toContain(
      'Failed to pass the check automatically for 3 times',
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
  });

  it('should not auto-escalate when failed-to-pass-check comment exists even if threshold met', async () => {
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
      createMockComment({
        content: 'Failed to pass the check automatically for 3 times',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should handle case-insensitive failed-to-pass-check comment', async () => {
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
      createMockComment({
        content: 'Failed to pass the check automatically for 5 times',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should not auto-escalate when new-format escalation comment with Auto Status Check prefix exists', async () => {
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
      createMockComment({
        content:
          'Auto Status Check: REJECTED\n- NO_REPORT_FROM_AGENT_BOT\n\nFailed to pass the check automatically for 3 times',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
      workflowBlockerResolvedWebhookUrl: null,
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
      {
        url: 'https://github.com/user/repo/pull/2',
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
        branchName: null,
        isConflicted: true,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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

  it('should reject with REQUIRED_CI_JOB_NEVER_STARTED when required checks are missing', async () => {
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: ['E2E Tests', 'deploy-preview'],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
      expect.stringContaining('REQUIRED_CI_JOB_NEVER_STARTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('E2E Tests'),
    );
  });

  it('should reject with ANY_CI_JOB_FAILED_OR_IN_PROGRESS when CI has failures and required checks are also missing', async () => {
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: ['deploy-preview'],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('deploy-preview'),
    );
  });

  it('should include PR URL in rejection comment details', async () => {
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('https://github.com/user/repo/pull/1'),
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: false,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
      workflowBlockerResolvedWebhookUrl: null,
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
        branchName: null,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
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
      workflowBlockerResolvedWebhookUrl: null,
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

  describe('workflow blocker webhook notification', () => {
    const createWorkflowBlockerStoryObjectMap = (
      issueUrl: string,
    ): StoryObjectMap => {
      const map: StoryObjectMap = new Map();
      map.set('Workflow Blocker Story', {
        story: {
          id: 'story-1',
          name: 'Workflow Blocker Story',
          color: 'GRAY',
          description: '',
        },
        storyIssue: null,
        issues: [createMockIssue({ url: issueUrl })],
      });
      return map;
    };

    const createNonBlockerStoryObjectMap = (): StoryObjectMap => {
      const map: StoryObjectMap = new Map();
      map.set('Regular Story', {
        story: {
          id: 'story-2',
          name: 'Regular Story',
          color: 'GRAY',
          description: '',
        },
        storyIssue: null,
        issues: [
          createMockIssue({
            url: 'https://github.com/user/repo/issues/99',
          }),
        ],
      });
      return map;
    };

    it('should send webhook when workflow blocker issue status changes to awaitingQualityCheckStatus on checks pass', async () => {
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
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createWorkflowBlockerStoryObjectMap(
          'https://github.com/user/repo/issues/1',
        ),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?url={URL}&msg={MESSAGE}',
      });

      expect(mockWebhookRepository.sendGetRequest).toHaveBeenCalledWith(
        `https://example.com/webhook?url=${encodeURIComponent('https://github.com/user/repo/issues/1')}&msg=${encodeURIComponent('Workflow blocker resolved: https://github.com/user/repo/issues/1')}`,
      );
    });

    it('should send webhook when workflow blocker issue auto-escalates', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content: 'Auto Status Check: REJECTED - first',
        }),
        createMockComment({
          content: 'Auto Status Check: REJECTED - second',
        }),
        createMockComment({
          content: 'Auto Status Check: REJECTED - third',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createWorkflowBlockerStoryObjectMap(
          'https://github.com/user/repo/issues/1',
        ),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/notify={MESSAGE}',
      });

      expect(mockWebhookRepository.sendGetRequest).toHaveBeenCalledTimes(1);
      expect(mockWebhookRepository.sendGetRequest).toHaveBeenCalledWith(
        expect.stringContaining('https://example.com/notify='),
      );
    });

    it('should not send webhook for non-blocker issues', async () => {
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
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createNonBlockerStoryObjectMap(),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?msg={MESSAGE}',
      });

      expect(mockWebhookRepository.sendGetRequest).not.toHaveBeenCalled();
    });

    it('should not send webhook when URL is null', async () => {
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
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockWebhookRepository.sendGetRequest).not.toHaveBeenCalled();
    });

    it('should log warning and not block workflow when webhook fails', async () => {
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
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createWorkflowBlockerStoryObjectMap(
          'https://github.com/user/repo/issues/1',
        ),
      );
      mockWebhookRepository.sendGetRequest.mockRejectedValue(
        new Error('Network error'),
      );

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?msg={MESSAGE}',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to send workflow blocker notification:',
        expect.any(Error),
      );
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );

      consoleWarnSpy.mockRestore();
    });

    it('should URL-encode placeholders in webhook URL', async () => {
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
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createWorkflowBlockerStoryObjectMap(
          'https://github.com/user/repo/issues/1',
        ),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/runTasker/notify=:={MESSAGE}',
      });

      const calledUrl = mockWebhookRepository.sendGetRequest.mock.calls[0][0];
      expect(calledUrl).not.toContain('{MESSAGE}');
      expect(calledUrl).not.toContain('{URL}');
      expect(calledUrl).toContain(
        encodeURIComponent('Workflow blocker resolved:'),
      );
    });
  });

  describe('REPORT_HAS_NEXT_STEP rejection', () => {
    it('should reject with REPORT_HAS_NEXT_STEP when last comment has JSON report with nextStep field', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: Agent\nSome output\n```json\n{"nextStep": "Fix the remaining issue"}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
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
        expect.stringContaining('REPORT_HAS_NEXT_STEP'),
      );
    });

    it('should not reject when last comment has JSON report with nextStep as null', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: Agent\nSome output\n```json\n{"nextStep": null}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
    });

    it('should not reject when last comment has JSON report without nextStep field', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: Agent\nSome output\n```json\n{"status": "done"}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
    });

    it('should not reject when last comment has no JSON block', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content: 'From: :robot: Agent\nWork is done, no JSON block here.',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
    });

    it('should not reject when last comment has JSON block with invalid JSON', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content: 'From: :robot: Agent\n```json\n{invalid json content}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid JSON in report body while checking nextStep:',
        expect.any(Error),
      );
      consoleWarnSpy.mockRestore();
    });

    it('should not reject when last comment has JSON block with non-object value', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content: 'From: :robot: Agent\n```json\n"just a string"\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
    });
  });

  describe('dependent issues', () => {
    it('should move to Awaiting Workspace with explanation comment when issue has dependedIssueUrls', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        dependedIssueUrls: ['https://github.com/user/repo/issues/2'],
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
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
        expect.stringContaining('https://github.com/user/repo/issues/2'),
      );
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
    });

    it('should not move to Awaiting Workspace for empty dependedIssueUrls', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        dependedIssueUrls: [],
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
    });

    it('should move to Awaiting Workspace when issue is enriched with dependedIssueUrls from getStoryObjectMap', async () => {
      const issueFetchedFromRepo = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        dependedIssueUrls: [],
      });

      const enrichedIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        dependedIssueUrls: ['https://github.com/user/repo/issues/2'],
      });

      const storyObjectMap: StoryObjectMap = new Map([
        [
          'Story 1',
          {
            story: {
              id: 'story-1',
              name: 'Story 1',
              color: 'GRAY' as const,
              description: '',
            },
            storyIssue: null,
            issues: [enrichedIssue],
          },
        ],
      ]);

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issueFetchedFromRepo);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Workspace',
          dependedIssueUrls: ['https://github.com/user/repo/issues/2'],
        }),
        mockProject,
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://github.com/user/repo/issues/1',
        }),
        expect.stringContaining('https://github.com/user/repo/issues/2'),
      );
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
    });

    it('should continue normally when getStoryObjectMap throws', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        dependedIssueUrls: [],
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.getStoryObjectMap.mockRejectedValue(
        new Error('TowerDefence unavailable'),
      );
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to enrich dependedIssueUrls from story object map:',
        expect.any(Error),
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('when project item is a pull request (isPr: true)', () => {
    const prItemUrl = 'https://github.com/user/repo/pull/158';

    it('should move to Awaiting Quality Check when PR is open and all checks pass', async () => {
      const issue = createMockIssue({
        url: prItemUrl,
        status: 'Preparation',
        isPr: true,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Test report' }),
      ]);
      mockIssueRepository.getOpenPullRequest.mockResolvedValue({
        url: prItemUrl,
        branchName: 'dependabot/npm_and_yarn/multi-cd28347e53',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: prItemUrl,
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
        prItemUrl,
      );
      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
    });

    it('should reject with PULL_REQUEST_NOT_FOUND when PR is not open', async () => {
      const issue = createMockIssue({
        url: prItemUrl,
        status: 'Preparation',
        isPr: true,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Test report' }),
      ]);
      mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: prItemUrl,
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
        prItemUrl,
      );
      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Workspace',
        }),
        mockProject,
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
      );
    });

    it('should reject with ANY_CI_JOB_FAILED_OR_IN_PROGRESS when PR CI fails', async () => {
      const issue = createMockIssue({
        url: prItemUrl,
        status: 'Preparation',
        isPr: true,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Test report' }),
      ]);
      mockIssueRepository.getOpenPullRequest.mockResolvedValue({
        url: prItemUrl,
        branchName: 'dependabot/npm_and_yarn/multi-cd28347e53',
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: prItemUrl,
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Workspace',
        }),
        mockProject,
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('ANY_CI_JOB_FAILED_OR_IN_PROGRESS'),
      );
    });
  });

  describe('next action date/hour', () => {
    it('should move to Awaiting Workspace with explanation comment when issue has nextActionDate set', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        nextActionDate: new Date('2026-05-01'),
        nextActionHour: null,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
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
        expect.stringContaining('next action date or hour'),
      );
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
    });

    it('should move to Awaiting Workspace with explanation comment when issue has nextActionHour set', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        nextActionDate: null,
        nextActionHour: 9,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
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
        expect.stringContaining('next action date or hour'),
      );
    });

    it('should not move to Awaiting Workspace when nextActionDate and nextActionHour are both null', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        nextActionDate: null,
        nextActionHour: null,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          branchName: null,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );
    });
  });
});
