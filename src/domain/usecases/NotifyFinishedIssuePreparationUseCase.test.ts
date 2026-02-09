import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: null,
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

describe('NotifyFinishedIssuePreparationUseCase', () => {
  let useCase: NotifyFinishedIssuePreparationUseCase;
  let mockIssueRepository: Mocked<IssueRepository>;

  beforeEach(() => {
    jest.resetAllMocks();

    mockIssueRepository = {
      getAllOpened: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      findRelatedOpenPRs: jest.fn(),
    };

    useCase = new NotifyFinishedIssuePreparationUseCase(mockIssueRepository);
  });

  it('should update issue status from Preparation to Awaiting Quality Check', async () => {
    const issue: Issue = createMockIssue({
      itemId: '1',
      url: 'https://github.com/user/repo/issues/1',
      title: 'Test Issue',
      labels: [],
      status: 'Preparation',
    });

    mockIssueRepository.get.mockResolvedValue(issue);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
    });

    expect(mockIssueRepository.update).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: '1',
        status: 'Awaiting Quality Check',
      }),
      'https://github.com/user/repo',
    );
  });

  it('should throw IssueNotFoundError when issue does not exist', async () => {
    mockIssueRepository.get.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        issueUrl: 'https://github.com/user/repo/issues/999',
        preparationStatus: 'Preparation',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
      }),
    ).rejects.toThrow(
      'Issue not found: https://github.com/user/repo/issues/999',
    );
  });

  it('should throw IllegalIssueStatusError when issue status is not Preparation', async () => {
    const issue: Issue = createMockIssue({
      itemId: '1',
      url: 'https://github.com/user/repo/issues/1',
      title: 'Test Issue',
      labels: [],
      status: 'Done',
    });

    mockIssueRepository.get.mockResolvedValue(issue);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
      }),
    ).rejects.toThrow(
      'Illegal issue status for https://github.com/user/repo/issues/1: expected Preparation, but got Done',
    );
  });
});
