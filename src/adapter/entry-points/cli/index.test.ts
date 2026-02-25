import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { program, loadConfigFile } from './index';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';

jest.mock('../../../domain/usecases/StartPreparationUseCase');
jest.mock('../../../domain/usecases/NotifyFinishedIssuePreparationUseCase');
jest.mock('../../repositories/TowerDefenceIssueRepository', () => ({
  TowerDefenceIssueRepository: jest.fn().mockImplementation(() => ({
    getAllOpened: jest.fn(),
    getStoryObjectMap: jest.fn(),
  })),
}));
jest.mock('../../repositories/GraphqlIssueRepository', () => ({
  GraphqlIssueRepository: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    update: jest.fn(),
    findRelatedOpenPRs: jest.fn(),
  })),
}));
jest.mock('../../repositories/TowerDefenceProjectRepository');
jest.mock('../../repositories/GitHubIssueCommentRepository');
jest.mock('../../repositories/NodeLocalCommandRunner');
jest.mock('../../repositories/OauthAPIClaudeRepository', () => ({
  OauthAPIClaudeRepository: jest.fn().mockImplementation(() => ({
    getUsage: jest.fn(),
    isClaudeAvailable: jest.fn(),
  })),
}));

describe('CLI', () => {
  const originalEnv = process.env;
  const tmpDir = path.join(__dirname, '../../../../tmp/test-cli');
  const configFilePath = path.join(tmpDir, 'config.yml');

  const defaultConfig = {
    org: 'HiromiShikata',
    projectUrl: 'https://github.com/test/project',
    awaitingWorkspaceStatus: 'Awaiting',
    preparationStatus: 'Preparing',
    defaultAgentName: 'agent1',
    awaitingQualityCheckStatus: 'Awaiting QC',
  };

  const writeConfig = (config: Record<string, unknown>): void => {
    fs.writeFileSync(configFilePath, yaml.dump(config));
  };

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(configFilePath)) {
      fs.unlinkSync(configFilePath);
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmdirSync(tmpDir);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GH_TOKEN: 'test-token' };
    writeConfig(defaultConfig);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export program', () => {
    expect(program).toBeDefined();
  });

  describe('loadConfigFile', () => {
    it('should load config from YAML file', () => {
      const config = {
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: '/path/to/log.txt',
        maximumPreparingIssuesCount: 10,
        utilizationPercentageThreshold: 75,
        awaitingQualityCheckStatus: 'Awaiting QC',
        thresholdForAutoReject: 5,
      };
      writeConfig(config);

      const result = loadConfigFile(configFilePath);

      expect(result).toEqual(config);
    });

    it('should return empty config for empty YAML', () => {
      fs.writeFileSync(configFilePath, '');

      const result = loadConfigFile(configFilePath);

      expect(result).toEqual({});
    });

    it('should ignore non-string values for string fields', () => {
      const config = {
        projectUrl: 123,
        awaitingWorkspaceStatus: true,
      };
      writeConfig(config);

      const result = loadConfigFile(configFilePath);

      expect(result.projectUrl).toBeUndefined();
      expect(result.awaitingWorkspaceStatus).toBeUndefined();
    });

    it('should ignore non-number values for number fields', () => {
      const config = {
        maximumPreparingIssuesCount: 'abc',
        utilizationPercentageThreshold: 'def',
        thresholdForAutoReject: 'ghi',
      };
      writeConfig(config);

      const result = loadConfigFile(configFilePath);

      expect(result.maximumPreparingIssuesCount).toBeUndefined();
      expect(result.utilizationPercentageThreshold).toBeUndefined();
      expect(result.thresholdForAutoReject).toBeUndefined();
    });

    it('should handle config with extra tower defence fields', () => {
      const config = {
        org: 'HiromiShikata',
        projectUrl: 'https://github.com/test/project',
        projectName: 'test-project',
        manager: 'HiromiShikata',
        allowIssueCacheMinutes: 0,
        credentials: {
          ghToken: 'test-token',
        },
        preparationStatus: 'Preparing',
      };
      writeConfig(config);

      const result = loadConfigFile(configFilePath);

      expect(result.projectUrl).toBe('https://github.com/test/project');
      expect(result.preparationStatus).toBe('Preparing');
    });

    it('should return empty config for array YAML', () => {
      fs.writeFileSync(configFilePath, '- item1\n- item2\n');

      const result = loadConfigFile(configFilePath);

      expect(result).toEqual({});
    });

    it('should exit with error when config file does not exist', () => {
      const nonExistentPath = path.join(tmpDir, 'nonexistent-config.yml');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      expect(() => loadConfigFile(nonExistentPath)).toThrow(
        'process.exit called',
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to load configuration file "${nonExistentPath}"`,
        ),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error for invalid YAML syntax', () => {
      fs.writeFileSync(configFilePath, 'invalid: [unclosed\n');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      expect(() => loadConfigFile(configFilePath)).toThrow(
        'process.exit called',
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to load configuration file "${configFilePath}"`,
        ),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when reading a directory instead of a file', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      expect(() => loadConfigFile(tmpDir)).toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to load configuration file "${tmpDir}"`,
        ),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('startDaemon', () => {
    it('should read parameters from config file', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

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
        '--configFilePath',
        configFilePath,
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: undefined,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
      });
    });

    it('should allow CLI args to override config file values', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

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
        '--configFilePath',
        configFilePath,
        '--projectUrl',
        'https://github.com/override/project',
        '--defaultAgentName',
        'override-agent',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/override/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'override-agent',
        logFilePath: undefined,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
      });
    });

    it('should pass logFilePath from config file', async () => {
      const configWithLog = {
        ...defaultConfig,
        logFilePath: '/path/to/log.txt',
      };
      writeConfig(configWithLog);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

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
        '--configFilePath',
        configFilePath,
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: '/path/to/log.txt',
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
      });
    });

    it('should pass logFilePath from CLI overriding config', async () => {
      const configWithLog = {
        ...defaultConfig,
        logFilePath: '/path/to/config-log.txt',
      };
      writeConfig(configWithLog);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

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
        '--configFilePath',
        configFilePath,
        '--logFilePath',
        '/path/to/cli-log.txt',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: '/path/to/cli-log.txt',
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
      });
    });

    it('should pass maximumPreparingIssuesCount from config file', async () => {
      const configWithCount = {
        ...defaultConfig,
        maximumPreparingIssuesCount: 10,
      };
      writeConfig(configWithCount);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

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
        '--configFilePath',
        configFilePath,
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: undefined,
        maximumPreparingIssuesCount: 10,
        utilizationPercentageThreshold: 90,
      });
    });

    it('should pass maximumPreparingIssuesCount from CLI overriding config', async () => {
      const configWithCount = {
        ...defaultConfig,
        maximumPreparingIssuesCount: 10,
      };
      writeConfig(configWithCount);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

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
        '--configFilePath',
        configFilePath,
        '--maximumPreparingIssuesCount',
        '20',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: undefined,
        maximumPreparingIssuesCount: 20,
        utilizationPercentageThreshold: 90,
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
          '--configFilePath',
          configFilePath,
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
          '--configFilePath',
          configFilePath,
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
          '--configFilePath',
          configFilePath,
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
          '--configFilePath',
          configFilePath,
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

    it('should pass custom utilizationPercentageThreshold from config file', async () => {
      const configWithThreshold = {
        ...defaultConfig,
        utilizationPercentageThreshold: 75,
      };
      writeConfig(configWithThreshold);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

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
        '--configFilePath',
        configFilePath,
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: undefined,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 75,
      });
    });

    it('should pass custom utilizationPercentageThreshold from CLI overriding config', async () => {
      const configWithThreshold = {
        ...defaultConfig,
        utilizationPercentageThreshold: 75,
      };
      writeConfig(configWithThreshold);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

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
        '--configFilePath',
        configFilePath,
        '--utilizationPercentageThreshold',
        '50',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: undefined,
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 50,
      });
    });

    it('should exit with error for non-numeric utilizationPercentageThreshold', async () => {
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
          '--configFilePath',
          configFilePath,
          '--utilizationPercentageThreshold',
          'abc',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid value for --utilizationPercentageThreshold. It must be a number between 0 and 100.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error for negative utilizationPercentageThreshold', async () => {
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
          '--configFilePath',
          configFilePath,
          '--utilizationPercentageThreshold',
          '-5',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid value for --utilizationPercentageThreshold. It must be a number between 0 and 100.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error for utilizationPercentageThreshold over 100', async () => {
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
          '--configFilePath',
          configFilePath,
          '--utilizationPercentageThreshold',
          '101',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid value for --utilizationPercentageThreshold. It must be a number between 0 and 100.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when GH_TOKEN is missing', async () => {
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
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'GH_TOKEN environment variable is required',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when projectUrl is missing from both CLI and config', async () => {
      const configWithoutProjectUrl = {
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
      };
      writeConfig(configWithoutProjectUrl);

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
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'projectUrl is required. Provide via --projectUrl or config file.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when awaitingWorkspaceStatus is missing from both CLI and config', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/test/project',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
      };
      writeConfig(configMissing);

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
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus or config file.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when preparationStatus is missing from both CLI and config', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        defaultAgentName: 'agent1',
      };
      writeConfig(configMissing);

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
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'preparationStatus is required. Provide via --preparationStatus or config file.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when defaultAgentName is missing from both CLI and config', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
      };
      writeConfig(configMissing);

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
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'defaultAgentName is required. Provide via --defaultAgentName or config file.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('notifyFinishedIssuePreparation', () => {
    it('should read parameters from config file', async () => {
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
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/issue/1',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        issueUrl: 'https://github.com/test/issue/1',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
        thresholdForAutoReject: 3,
      });
    });

    it('should allow CLI args to override config file values', async () => {
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
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/issue/1',
        '--projectUrl',
        'https://github.com/override/project',
        '--awaitingQualityCheckStatus',
        'Override QC',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/override/project',
        issueUrl: 'https://github.com/test/issue/1',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Override QC',
        thresholdForAutoReject: 3,
      });
    });

    it('should pass custom thresholdForAutoReject from config file', async () => {
      const configWithThreshold = {
        ...defaultConfig,
        thresholdForAutoReject: 5,
      };
      writeConfig(configWithThreshold);

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
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/issue/1',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        issueUrl: 'https://github.com/test/issue/1',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
        thresholdForAutoReject: 5,
      });
    });

    it('should pass custom thresholdForAutoReject from CLI overriding config', async () => {
      const configWithThreshold = {
        ...defaultConfig,
        thresholdForAutoReject: 5,
      };
      writeConfig(configWithThreshold);

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
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/issue/1',
        '--thresholdForAutoReject',
        '7',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        issueUrl: 'https://github.com/test/issue/1',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
        thresholdForAutoReject: 7,
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
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/issue/1',
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

    it('should exit with error when GH_TOKEN is missing', async () => {
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
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/issue/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'GH_TOKEN environment variable is required',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when projectUrl is missing from both CLI and config', async () => {
      const configMissing = {
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
      };
      writeConfig(configMissing);

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
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/issue/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'projectUrl is required. Provide via --projectUrl or config file.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when preparationStatus is missing from both CLI and config', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/test/project',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
      };
      writeConfig(configMissing);

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
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/issue/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'preparationStatus is required. Provide via --preparationStatus or config file.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when awaitingWorkspaceStatus is missing from both CLI and config', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/test/project',
        preparationStatus: 'Preparing',
        awaitingQualityCheckStatus: 'Awaiting QC',
      };
      writeConfig(configMissing);

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
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/issue/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus or config file.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when awaitingQualityCheckStatus is missing from both CLI and config', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/test/project',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
      };
      writeConfig(configMissing);

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
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/issue/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'awaitingQualityCheckStatus is required. Provide via --awaitingQualityCheckStatus or config file.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });
});
