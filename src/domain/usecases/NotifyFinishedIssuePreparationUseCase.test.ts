import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { CopilotRepository } from './adapter-interfaces/CopilotRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

describe('NotifyFinishedIssuePreparationUseCase', () => {
  let useCase: NotifyFinishedIssuePreparationUseCase;
  let mockProjectRepository: Mocked<ProjectRepository>;
  let mockIssueRepository: Mocked<IssueRepository>;
  let mockCopilotRepository: Mocked<CopilotRepository>;

  const mockProject: Project = {
    id: 'project-1',
    url: 'https://github.com/user/repo',
    name: 'Test Project',
    statuses: [
      'Preparation',
      'Awaiting Auto Quality Check',
      'Awaiting Quality Check',
      'Done',
    ],
    customFieldNames: ['workspace'],
    statusFieldId: 'status-field-id',
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockProjectRepository = {
      getByUrl: jest.fn(),
      prepareStatus: jest.fn(),
    };

    mockIssueRepository = {
      getAllOpened: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    };

    mockCopilotRepository = {
      run: jest.fn(),
    };

    useCase = new NotifyFinishedIssuePreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockCopilotRepository,
    );
  });

  it('should update issue status from Preparation to Awaiting Auto Quality Check and call Copilot', async () => {
    const issue: Issue = {
      id: '1',
      url: 'https://github.com/user/repo/issues/1',
      title: 'Test Issue',
      labels: [],
      status: 'Preparation',
      comments: [],
    };

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingAutoQualityCheckStatus: 'Awaiting Auto Quality Check',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      commentCountThreshold: 5,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        status: 'Awaiting Auto Quality Check',
      }),
      mockProject,
    );
    expect(mockCopilotRepository.run).toHaveBeenCalledTimes(1);
    expect(mockCopilotRepository.run).toHaveBeenCalledWith(
      expect.stringContaining('https://github.com/user/repo/issues/1'),
      'gpt-5-mini',
      'Test Issue',
    );
  });

  it('should include correct parameters in Copilot prompt', async () => {
    const issue: Issue = {
      id: '1',
      url: 'https://github.com/user/repo/issues/1',
      title: 'Test Issue',
      labels: [],
      status: 'Preparation',
      comments: [],
    };

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      issueUrl: 'https://github.com/user/repo/issues/1',
      preparationStatus: 'Preparation',
      awaitingAutoQualityCheckStatus: 'Awaiting Auto Quality Check',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      commentCountThreshold: 10,
    });

    const promptArg = mockCopilotRepository.run.mock.calls[0][0];
    expect(promptArg).toContain('Awaiting Quality Check');
    expect(promptArg).toContain('Preparation');
    expect(promptArg).toContain('10');
    expect(promptArg).toContain('project-1');
    expect(promptArg).toContain('status-field-id');
  });

  it('should throw IssueNotFoundError when issue does not exist', async () => {
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        issueUrl: 'https://github.com/user/repo/issues/999',
        preparationStatus: 'Preparation',
        awaitingAutoQualityCheckStatus: 'Awaiting Auto Quality Check',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        commentCountThreshold: 5,
      }),
    ).rejects.toThrow(
      'Issue not found: https://github.com/user/repo/issues/999',
    );

    expect(mockCopilotRepository.run).not.toHaveBeenCalled();
  });

  it('should throw IllegalIssueStatusError when issue status is not Preparation', async () => {
    const issue: Issue = {
      id: '1',
      url: 'https://github.com/user/repo/issues/1',
      title: 'Test Issue',
      labels: [],
      status: 'Done',
      comments: [],
    };

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        issueUrl: 'https://github.com/user/repo/issues/1',
        preparationStatus: 'Preparation',
        awaitingAutoQualityCheckStatus: 'Awaiting Auto Quality Check',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        commentCountThreshold: 5,
      }),
    ).rejects.toThrow(
      'Illegal issue status for https://github.com/user/repo/issues/1: expected Preparation, but got Done',
    );

    expect(mockCopilotRepository.run).not.toHaveBeenCalled();
  });
});
