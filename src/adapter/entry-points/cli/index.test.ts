import { program } from './index';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';

jest.mock('../../../domain/usecases/StartPreparationUseCase');
jest.mock('../../../domain/usecases/NotifyFinishedIssuePreparationUseCase');
jest.mock('../../repositories/GitHubProjectRepository');
jest.mock('../../repositories/GitHubIssueRepository');
jest.mock('../../repositories/NodeLocalCommandRunner');

describe('CLI', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GH_TOKEN: 'test-token' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export program', () => {
    expect(program).toBeDefined();
  });

  it('should pass correct parameters to StartPreparationUseCase', async () => {
    const mockRun = jest.fn().mockResolvedValue(undefined);
    const MockedStartPreparationUseCase = jest.mocked(StartPreparationUseCase);

    MockedStartPreparationUseCase.mockImplementation(function (
      this: StartPreparationUseCase,
    ) {
      this.run = mockRun;
      this.maximumPreparingIssuesCount = 6;
      return this;
    });

    await program.parseAsync([
      'node',
      'test',
      'startDaemon',
      '--projectUrl',
      'https://github.com/test/project',
      '--awaitingWorkspaceStatus',
      'Awaiting',
      '--preparationStatus',
      'Preparing',
      '--defaultAgentName',
      'agent1',
    ]);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      projectUrl: 'https://github.com/test/project',
      awaitingWorkspaceStatus: 'Awaiting',
      preparationStatus: 'Preparing',
      defaultAgentName: 'agent1',
      logFilePath: undefined,
    });
  });

  it('should pass logFilePath to StartPreparationUseCase when provided', async () => {
    const mockRun = jest.fn().mockResolvedValue(undefined);
    const MockedStartPreparationUseCase = jest.mocked(StartPreparationUseCase);

    MockedStartPreparationUseCase.mockImplementation(function (
      this: StartPreparationUseCase,
    ) {
      this.run = mockRun;
      this.maximumPreparingIssuesCount = 6;
      return this;
    });

    await program.parseAsync([
      'node',
      'test',
      'startDaemon',
      '--projectUrl',
      'https://github.com/test/project',
      '--awaitingWorkspaceStatus',
      'Awaiting',
      '--preparationStatus',
      'Preparing',
      '--defaultAgentName',
      'agent1',
      '--logFilePath',
      '/path/to/log.txt',
    ]);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      projectUrl: 'https://github.com/test/project',
      awaitingWorkspaceStatus: 'Awaiting',
      preparationStatus: 'Preparing',
      defaultAgentName: 'agent1',
      logFilePath: '/path/to/log.txt',
    });
  });

  it('should pass correct parameters to NotifyFinishedIssuePreparationUseCase', async () => {
    const mockRun = jest.fn().mockResolvedValue(undefined);
    const MockedNotifyFinishedUseCase = jest.mocked(
      NotifyFinishedIssuePreparationUseCase,
    );

    MockedNotifyFinishedUseCase.mockImplementation(function (
      this: NotifyFinishedIssuePreparationUseCase,
    ) {
      this.run = mockRun;
      return this;
    });

    await program.parseAsync([
      'node',
      'test',
      'notifyFinishedIssuePreparation',
      '--projectUrl',
      'https://github.com/test/project',
      '--issueUrl',
      'https://github.com/test/issue/1',
      '--preparationStatus',
      'Preparing',
      '--awaitingQualityCheckStatus',
      'Awaiting QC',
    ]);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      projectUrl: 'https://github.com/test/project',
      issueUrl: 'https://github.com/test/issue/1',
      preparationStatus: 'Preparing',
      awaitingQualityCheckStatus: 'Awaiting QC',
    });
  });

  it('should exit with error when GH_TOKEN is missing for startDaemon', async () => {
    delete process.env.GH_TOKEN;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => {
        throw new Error('process.exit called');
      });

    await expect(
      program.parseAsync([
        'node',
        'test',
        'startDaemon',
        '--projectUrl',
        'https://github.com/test/project',
        '--awaitingWorkspaceStatus',
        'Awaiting',
        '--preparationStatus',
        'Preparing',
        '--defaultAgentName',
        'agent1',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GH_TOKEN environment variable is required',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should exit with error when GH_TOKEN is missing for notifyFinishedIssuePreparation', async () => {
    delete process.env.GH_TOKEN;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => {
        throw new Error('process.exit called');
      });

    await expect(
      program.parseAsync([
        'node',
        'test',
        'notifyFinishedIssuePreparation',
        '--projectUrl',
        'https://github.com/test/project',
        '--issueUrl',
        'https://github.com/test/issue/1',
        '--preparationStatus',
        'Preparing',
        '--awaitingQualityCheckStatus',
        'Awaiting QC',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GH_TOKEN environment variable is required',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });
});
