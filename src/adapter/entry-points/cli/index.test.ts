import { program } from './index';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';

jest.mock('../../../domain/usecases/StartPreparationUseCase');
jest.mock('../../../domain/usecases/NotifyFinishedIssuePreparationUseCase');
jest.mock('../../repositories/TowerDefenceIssueRepository');
jest.mock('../../repositories/TowerDefenceProjectRepository');
jest.mock('../../repositories/GitHubIssueCommentRepository');
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
      '--configFilePath',
      '/path/to/config.yml',
    ]);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      projectUrl: 'https://github.com/test/project',
      awaitingWorkspaceStatus: 'Awaiting',
      preparationStatus: 'Preparing',
      defaultAgentName: 'agent1',
      logFilePath: undefined,
      maximumPreparingIssuesCount: null,
    });
  });

  it('should pass logFilePath to StartPreparationUseCase when provided', async () => {
    const mockRun = jest.fn().mockResolvedValue(undefined);
    const MockedStartPreparationUseCase = jest.mocked(StartPreparationUseCase);

    MockedStartPreparationUseCase.mockImplementation(function (
      this: StartPreparationUseCase,
    ) {
      this.run = mockRun;
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
      '--configFilePath',
      '/path/to/config.yml',
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
      maximumPreparingIssuesCount: null,
    });
  });

  it('should pass maximumPreparingIssuesCount to StartPreparationUseCase when provided', async () => {
    const mockRun = jest.fn().mockResolvedValue(undefined);
    const MockedStartPreparationUseCase = jest.mocked(StartPreparationUseCase);

    MockedStartPreparationUseCase.mockImplementation(function (
      this: StartPreparationUseCase,
    ) {
      this.run = mockRun;
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
      '--configFilePath',
      '/path/to/config.yml',
      '--maximumPreparingIssuesCount',
      '10',
    ]);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      projectUrl: 'https://github.com/test/project',
      awaitingWorkspaceStatus: 'Awaiting',
      preparationStatus: 'Preparing',
      defaultAgentName: 'agent1',
      logFilePath: undefined,
      maximumPreparingIssuesCount: 10,
    });
  });

  it('should exit with error for non-numeric maximumPreparingIssuesCount', async () => {
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
        '--configFilePath',
        '/path/to/config.yml',
        '--maximumPreparingIssuesCount',
        'abc',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should exit with error for negative maximumPreparingIssuesCount', async () => {
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
        '--configFilePath',
        '/path/to/config.yml',
        '--maximumPreparingIssuesCount',
        '-5',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should exit with error for zero maximumPreparingIssuesCount', async () => {
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
        '--configFilePath',
        '/path/to/config.yml',
        '--maximumPreparingIssuesCount',
        '0',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should exit with error for decimal maximumPreparingIssuesCount', async () => {
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
        '--configFilePath',
        '/path/to/config.yml',
        '--maximumPreparingIssuesCount',
        '3.5',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
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
      '--awaitingWorkspaceStatus',
      'Awaiting Workspace',
      '--awaitingQualityCheckStatus',
      'Awaiting QC',
      '--configFilePath',
      '/path/to/config.yml',
    ]);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      projectUrl: 'https://github.com/test/project',
      issueUrl: 'https://github.com/test/issue/1',
      preparationStatus: 'Preparing',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting QC',
      thresholdForAutoReject: 3,
    });
  });

  it('should pass custom thresholdForAutoReject to NotifyFinishedIssuePreparationUseCase', async () => {
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
      '--awaitingWorkspaceStatus',
      'Awaiting Workspace',
      '--awaitingQualityCheckStatus',
      'Awaiting QC',
      '--configFilePath',
      '/path/to/config.yml',
      '--thresholdForAutoReject',
      '5',
    ]);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      projectUrl: 'https://github.com/test/project',
      issueUrl: 'https://github.com/test/issue/1',
      preparationStatus: 'Preparing',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting QC',
      thresholdForAutoReject: 5,
    });
  });

  it('should exit with error for invalid thresholdForAutoReject', async () => {
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
        '--awaitingWorkspaceStatus',
        'Awaiting Workspace',
        '--awaitingQualityCheckStatus',
        'Awaiting QC',
        '--configFilePath',
        '/path/to/config.yml',
        '--thresholdForAutoReject',
        'abc',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalid value for --thresholdForAutoReject. It must be a positive integer.',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
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
        '--configFilePath',
        '/path/to/config.yml',
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
        '--awaitingWorkspaceStatus',
        'Awaiting Workspace',
        '--awaitingQualityCheckStatus',
        'Awaiting QC',
        '--configFilePath',
        '/path/to/config.yml',
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
