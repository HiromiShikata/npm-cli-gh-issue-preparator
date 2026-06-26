import {
  StaleTmuxSessionKillUseCase,
  DEFAULT_EXCLUDED_STATUS,
  DEFAULT_IDLE_THRESHOLD_SECONDS,
} from './StaleTmuxSessionKillUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
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
    statuses: [],
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
  status: DEFAULT_EXCLUDED_STATUS,
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

const sessionNameOf = (issueUrl: string): string =>
  issueUrl.replace(/[.:]/g, '_');

describe('StaleTmuxSessionKillUseCase', () => {
  let useCase: StaleTmuxSessionKillUseCase;
  let mockProjectRepository: Mocked<Pick<ProjectRepository, 'getByUrl'>>;
  let mockIssueRepository: Mocked<Pick<IssueRepository, 'getAllOpened'>>;
  let mockLocalCommandRunner: Mocked<Pick<LocalCommandRunner, 'runCommand'>>;
  let mockProject: Project;
  const now = new Date('2026-06-26T00:00:00Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);

  const runParams = {
    projectUrl: 'https://github.com/user/repo',
    excludedStatus: DEFAULT_EXCLUDED_STATUS,
    idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
    now,
  };

  const setLiveSessions = (lines: string[]): void => {
    mockLocalCommandRunner.runCommand.mockResolvedValueOnce({
      stdout: lines.join('\n'),
      stderr: '',
      exitCode: 0,
    });
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockProject = createMockProject();
    mockProjectRepository = {
      getByUrl: jest.fn().mockResolvedValue(mockProject),
    };
    mockIssueRepository = {
      getAllOpened: jest.fn().mockResolvedValue([]),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      }),
    };
    useCase = new StaleTmuxSessionKillUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockLocalCommandRunner,
    );
  });

  it('exposes the excluded status and idle threshold as named constants', () => {
    expect(DEFAULT_EXCLUDED_STATUS).toBe('In Tmux by human');
    expect(DEFAULT_IDLE_THRESHOLD_SECONDS).toBe(86400);
  });

  it('lists live sessions via the local command runner', async () => {
    setLiveSessions([]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith('tmux', [
      'list-sessions',
      '-F',
      '#{session_name} #{session_activity}',
    ]);
  });

  it('kills a session mapping to an open issue whose status is not the excluded status', async () => {
    const issueUrl = 'https://github.com/user/repo/issues/10';
    const sessionName = sessionNameOf(issueUrl);
    setLiveSessions([`${sessionName} ${nowEpochSeconds}`]);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      createMockIssue({ url: issueUrl, status: 'In Progress' }),
    ]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith('tmux', [
      'kill-session',
      '-t',
      sessionName,
    ]);
  });

  it('kills a session mapping to an open issue whose status is null', async () => {
    const issueUrl = 'https://github.com/user/repo/issues/11';
    const sessionName = sessionNameOf(issueUrl);
    setLiveSessions([`${sessionName} ${nowEpochSeconds}`]);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      createMockIssue({ url: issueUrl, status: null }),
    ]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith('tmux', [
      'kill-session',
      '-t',
      sessionName,
    ]);
  });

  it('kills an excluded-status session that has a next action date set', async () => {
    const issueUrl = 'https://github.com/user/repo/issues/12';
    const sessionName = sessionNameOf(issueUrl);
    setLiveSessions([`${sessionName} ${nowEpochSeconds}`]);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      createMockIssue({
        url: issueUrl,
        status: DEFAULT_EXCLUDED_STATUS,
        nextActionDate: new Date('2026-06-27T00:00:00Z'),
      }),
    ]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith('tmux', [
      'kill-session',
      '-t',
      sessionName,
    ]);
  });

  it('kills an excluded-status session that has a next action hour set', async () => {
    const issueUrl = 'https://github.com/user/repo/issues/13';
    const sessionName = sessionNameOf(issueUrl);
    setLiveSessions([`${sessionName} ${nowEpochSeconds}`]);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      createMockIssue({
        url: issueUrl,
        status: DEFAULT_EXCLUDED_STATUS,
        nextActionHour: 9,
      }),
    ]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith('tmux', [
      'kill-session',
      '-t',
      sessionName,
    ]);
  });

  it('never kills an excluded-status session that has no reactivation trigger', async () => {
    const issueUrl = 'https://github.com/user/repo/issues/14';
    const sessionName = sessionNameOf(issueUrl);
    setLiveSessions([`${sessionName} ${nowEpochSeconds}`]);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      createMockIssue({
        url: issueUrl,
        status: DEFAULT_EXCLUDED_STATUS,
        nextActionDate: null,
        nextActionHour: null,
      }),
    ]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).not.toHaveBeenCalledWith('tmux', [
      'kill-session',
      '-t',
      sessionName,
    ]);
  });

  it('kills a no-task session that has been idle at least the idle threshold', async () => {
    const sessionName = 'no_task_session';
    const idleActivity = nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS;
    setLiveSessions([`${sessionName} ${idleActivity}`]);
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith('tmux', [
      'kill-session',
      '-t',
      sessionName,
    ]);
  });

  it('never kills a no-task session that was active within the idle threshold', async () => {
    const sessionName = 'no_task_session';
    const recentActivity = nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS + 1;
    setLiveSessions([`${sessionName} ${recentActivity}`]);
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).not.toHaveBeenCalledWith('tmux', [
      'kill-session',
      '-t',
      sessionName,
    ]);
  });

  it('does nothing when there are no live sessions', async () => {
    setLiveSessions(['', '   ']);
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledTimes(1);
  });

  it('maps a session back to its issue using the dot-and-colon-to-underscore convention', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/9';
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    expect(sessionNameOf(issueUrl)).toBe(sessionName);
    setLiveSessions([`${sessionName} ${nowEpochSeconds}`]);
    mockIssueRepository.getAllOpened.mockResolvedValue([
      createMockIssue({ url: issueUrl, status: 'In Progress' }),
    ]);
    await useCase.run(runParams);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith('tmux', [
      'kill-session',
      '-t',
      sessionName,
    ]);
  });
});
