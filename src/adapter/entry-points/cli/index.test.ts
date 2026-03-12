import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import {
  program,
  loadConfigFile,
  parseProjectReadmeConfig,
  mergeConfigs,
} from './index';
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
const mockFetchReadme = jest.fn().mockResolvedValue(null);
jest.mock('../../repositories/GraphqlProjectRepository', () => ({
  GraphqlProjectRepository: jest.fn().mockImplementation(() => ({
    fetchReadme: mockFetchReadme,
  })),
}));
jest.mock('../../repositories/GitHubIssueCommentRepository');
jest.mock('../../repositories/NodeLocalCommandRunner');
jest.mock('../../repositories/OauthAPIClaudeRepository', () => ({
  OauthAPIClaudeRepository: jest.fn().mockImplementation(() => ({
    getUsage: jest.fn(),
    isClaudeAvailable: jest.fn(),
  })),
}));
jest.mock('../../repositories/FetchWebhookRepository', () => ({
  FetchWebhookRepository: jest.fn().mockImplementation(() => ({
    sendGetRequest: jest.fn(),
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
    mockFetchReadme.mockResolvedValue(null);
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
        allowedIssueAuthors: 'user1,user2',
        workflowBlockerResolvedWebhookUrl: 'https://example.com/webhook',
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

  describe('parseProjectReadmeConfig', () => {
    it('should parse YAML from details/summary config section', () => {
      const readme = `# Project
Some description
<details>
<summary>config</summary>
awaitingWorkspaceStatus: 'Custom Awaiting'
preparationStatus: 'Custom Preparing'
defaultAgentName: 'readme-agent'
</details>`;

      const result = parseProjectReadmeConfig(readme);

      expect(result.awaitingWorkspaceStatus).toBe('Custom Awaiting');
      expect(result.preparationStatus).toBe('Custom Preparing');
      expect(result.defaultAgentName).toBe('readme-agent');
    });

    it('should return empty config when no details/summary section exists', () => {
      const readme = '# Project\nSome description without config section';

      const result = parseProjectReadmeConfig(readme);

      expect(result).toEqual({});
    });

    it('should return empty config when details section has empty content', () => {
      const readme = '<details>\n<summary>config</summary>\n</details>';

      const result = parseProjectReadmeConfig(readme);

      expect(result).toEqual({});
    });

    it('should return empty config when YAML content is not a record', () => {
      const readme =
        '<details>\n<summary>config</summary>\n- item1\n- item2\n</details>';

      const result = parseProjectReadmeConfig(readme);

      expect(result).toEqual({});
    });

    it('should handle invalid YAML gracefully', () => {
      const readme =
        '<details>\n<summary>config</summary>\ninvalid: [unclosed\n</details>';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseProjectReadmeConfig(readme);

      expect(result).toEqual({});
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to parse YAML from project README config section',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should parse number fields from README config', () => {
      const readme = `<details>
<summary>config</summary>
maximumPreparingIssuesCount: 15
utilizationPercentageThreshold: 80
thresholdForAutoReject: 5
</details>`;

      const result = parseProjectReadmeConfig(readme);

      expect(result.maximumPreparingIssuesCount).toBe(15);
      expect(result.utilizationPercentageThreshold).toBe(80);
      expect(result.thresholdForAutoReject).toBe(5);
    });

    it('should be case-insensitive for the summary tag', () => {
      const readme = `<details>
<SUMMARY>config</SUMMARY>
defaultAgentName: 'case-test-agent'
</details>`;

      const result = parseProjectReadmeConfig(readme);

      expect(result.defaultAgentName).toBe('case-test-agent');
    });
  });

  describe('mergeConfigs', () => {
    it('should use configFile values when no overrides', () => {
      const configFile = {
        projectUrl: 'https://github.com/config/project',
        defaultAgentName: 'config-agent',
      };

      const result = mergeConfigs(configFile, {}, {});

      expect(result.projectUrl).toBe('https://github.com/config/project');
      expect(result.defaultAgentName).toBe('config-agent');
    });

    it('should use CLI overrides over configFile', () => {
      const configFile = {
        projectUrl: 'https://github.com/config/project',
        defaultAgentName: 'config-agent',
      };
      const cliOverrides = {
        defaultAgentName: 'cli-agent',
      };

      const result = mergeConfigs(configFile, cliOverrides, {});

      expect(result.projectUrl).toBe('https://github.com/config/project');
      expect(result.defaultAgentName).toBe('cli-agent');
    });

    it('should use README overrides over both CLI and configFile', () => {
      const configFile = {
        projectUrl: 'https://github.com/config/project',
        defaultAgentName: 'config-agent',
      };
      const cliOverrides = {
        defaultAgentName: 'cli-agent',
      };
      const readmeOverrides = {
        defaultAgentName: 'readme-agent',
      };

      const result = mergeConfigs(configFile, cliOverrides, readmeOverrides);

      expect(result.projectUrl).toBe('https://github.com/config/project');
      expect(result.defaultAgentName).toBe('readme-agent');
    });

    it('should merge all config fields with correct priority', () => {
      const configFile = {
        projectUrl: 'https://github.com/config/project',
        awaitingWorkspaceStatus: 'Config Awaiting',
        preparationStatus: 'Config Preparing',
        defaultAgentName: 'config-agent',
        maximumPreparingIssuesCount: 5,
      };
      const cliOverrides = {
        awaitingWorkspaceStatus: 'CLI Awaiting',
        maximumPreparingIssuesCount: 10,
      };
      const readmeOverrides = {
        maximumPreparingIssuesCount: 20,
        allowedIssueAuthors: 'readme-user1,readme-user2',
      };

      const result = mergeConfigs(configFile, cliOverrides, readmeOverrides);

      expect(result.projectUrl).toBe('https://github.com/config/project');
      expect(result.awaitingWorkspaceStatus).toBe('CLI Awaiting');
      expect(result.preparationStatus).toBe('Config Preparing');
      expect(result.defaultAgentName).toBe('config-agent');
      expect(result.maximumPreparingIssuesCount).toBe(20);
      expect(result.allowedIssueAuthors).toBe('readme-user1,readme-user2');
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
        allowedIssueAuthors: null,
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
        allowedIssueAuthors: null,
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
        allowedIssueAuthors: null,
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
        allowedIssueAuthors: null,
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
        allowedIssueAuthors: null,
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
        allowedIssueAuthors: null,
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
        allowedIssueAuthors: null,
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
        allowedIssueAuthors: null,
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
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
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
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.',
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
        'preparationStatus is required. Provide via --preparationStatus, config file, or project README.',
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
        'defaultAgentName is required. Provide via --defaultAgentName, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should pass allowedIssueAuthors from config file', async () => {
      const configWithAuthors = {
        ...defaultConfig,
        allowedIssueAuthors: 'user1,user2',
      };
      writeConfig(configWithAuthors);

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
        allowedIssueAuthors: ['user1', 'user2'],
      });
    });

    it('should normalize empty allowedIssueAuthors to null', async () => {
      const configWithEmptyAuthors = {
        ...defaultConfig,
        allowedIssueAuthors: '',
      };
      writeConfig(configWithEmptyAuthors);

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
        allowedIssueAuthors: null,
      });
    });

    it('should pass allowedIssueAuthors from CLI overriding config', async () => {
      const configWithAuthors = {
        ...defaultConfig,
        allowedIssueAuthors: 'user1,user2',
      };
      writeConfig(configWithAuthors);

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
        '--allowedIssueAuthors',
        'user3,user4',
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
        allowedIssueAuthors: ['user3', 'user4'],
      });
    });

    it('should log maximumPreparingIssuesCount and utilizationPercentageThreshold before calling useCase.run', async () => {
      const configWithValues = {
        ...defaultConfig,
        maximumPreparingIssuesCount: 10,
        utilizationPercentageThreshold: 75,
      };
      writeConfig(configWithValues);

      const callOrder: string[] = [];
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {
          callOrder.push('console.log');
        });
      const mockRun = jest.fn().mockImplementation(() => {
        callOrder.push('useCase.run');
        return Promise.resolve(undefined);
      });
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

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'maximumPreparingIssuesCount: 10, utilizationPercentageThreshold: 75',
      );
      expect(mockRun).toHaveBeenCalledTimes(1);
      const logIndex = callOrder.indexOf('console.log');
      const runIndex = callOrder.indexOf('useCase.run');
      expect(logIndex).toBeLessThan(runIndex);

      consoleLogSpy.mockRestore();
    });

    it('should log default hint for maximumPreparingIssuesCount when not set', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'maximumPreparingIssuesCount: null (default: 6), utilizationPercentageThreshold: 90',
      );
      expect(mockRun).toHaveBeenCalledTimes(1);

      consoleLogSpy.mockRestore();
    });

    it('should continue when README fetch throws error', async () => {
      mockFetchReadme.mockRejectedValueOnce(new Error('Network error'));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
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

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch project README',
      );
      expect(mockRun).toHaveBeenCalledTimes(1);

      consoleWarnSpy.mockRestore();
    });

    it('should apply README config overrides', async () => {
      const readmeContent = [
        '# Project',
        '<details>',
        '<summary>config</summary>',
        'defaultAgentName: readme-agent',
        '</details>',
      ].join('\n');
      mockFetchReadme.mockResolvedValueOnce(readmeContent);

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
      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultAgentName: 'readme-agent',
        }),
      );
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
        workflowBlockerResolvedWebhookUrl: null,
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
        workflowBlockerResolvedWebhookUrl: null,
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
        workflowBlockerResolvedWebhookUrl: null,
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
        workflowBlockerResolvedWebhookUrl: null,
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
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
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
        'preparationStatus is required. Provide via --preparationStatus, config file, or project README.',
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
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.',
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
        'awaitingQualityCheckStatus is required. Provide via --awaitingQualityCheckStatus, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should pass workflowBlockerResolvedWebhookUrl from config file', async () => {
      const configWithWebhook = {
        ...defaultConfig,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?url={URL}',
      };
      writeConfig(configWithWebhook);

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
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?url={URL}',
      });
    });

    it('should pass workflowBlockerResolvedWebhookUrl from CLI overriding config', async () => {
      const configWithWebhook = {
        ...defaultConfig,
        workflowBlockerResolvedWebhookUrl: 'https://example.com/config-webhook',
      };
      writeConfig(configWithWebhook);

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
        '--workflowBlockerResolvedWebhookUrl',
        'https://example.com/cli-webhook',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/test/project',
        issueUrl: 'https://github.com/test/issue/1',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: 'https://example.com/cli-webhook',
      });
    });

    it('should continue when README fetch throws error', async () => {
      mockFetchReadme.mockRejectedValueOnce(new Error('Network error'));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
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

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch project README',
      );
      expect(mockRun).toHaveBeenCalledTimes(1);

      consoleWarnSpy.mockRestore();
    });

    it('should apply README config overrides', async () => {
      const readmeContent = [
        '# Project',
        '<details>',
        '<summary>config</summary>',
        "awaitingQualityCheckStatus: 'README QC'",
        '</details>',
      ].join('\n');
      mockFetchReadme.mockResolvedValueOnce(readmeContent);

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
      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          awaitingQualityCheckStatus: 'README QC',
        }),
      );
    });
  });
});
