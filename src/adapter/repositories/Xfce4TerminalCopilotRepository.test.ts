const mockUnref = jest.fn();
const mockSpawn = jest.fn(() => ({ unref: mockUnref }));

jest.mock('child_process', () => ({
  spawn: mockSpawn,
}));

import { Xfce4TerminalCopilotRepository } from './Xfce4TerminalCopilotRepository';

describe('Xfce4TerminalCopilotRepository', () => {
  let repository: Xfce4TerminalCopilotRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new Xfce4TerminalCopilotRepository();
  });

  describe('run', () => {
    it('should spawn xfce4-terminal with correct arguments', () => {
      repository.run('test prompt', 'gpt-5-mini', 'test-process');

      expect(mockSpawn).toHaveBeenCalledWith(
        'xfce4-terminal',
        [
          '-T',
          'gh-issue-preparator: test-process',
          '-e',
          "bash -c 'copilot --model gpt-5-mini --allow-all-tools -p '\\''test prompt'\\'''",
        ],
        {
          detached: true,
          stdio: 'ignore',
        },
      );
      expect(mockUnref).toHaveBeenCalled();
    });

    it('should escape single quotes in prompt to prevent command injection', () => {
      repository.run(
        "prompt with 'single quotes'",
        'gpt-5-mini',
        'test-process',
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        'xfce4-terminal',
        [
          '-T',
          'gh-issue-preparator: test-process',
          '-e',
          "bash -c 'copilot --model gpt-5-mini --allow-all-tools -p '\\''prompt with '\\''\\'\\'''\\''single quotes'\\''\\'\\'''\\'''\\'''",
        ],
        {
          detached: true,
          stdio: 'ignore',
        },
      );
    });

    it('should escape backticks in prompt to prevent command injection', () => {
      repository.run('prompt with `backticks`', 'gpt-5-mini', 'test-process');

      expect(mockSpawn).toHaveBeenCalledWith(
        'xfce4-terminal',
        [
          '-T',
          'gh-issue-preparator: test-process',
          '-e',
          "bash -c 'copilot --model gpt-5-mini --allow-all-tools -p '\\''prompt with `backticks`'\\'''",
        ],
        {
          detached: true,
          stdio: 'ignore',
        },
      );
    });

    it('should escape command substitution in prompt to prevent injection', () => {
      repository.run('prompt with $(whoami)', 'gpt-5-mini', 'test-process');

      expect(mockSpawn).toHaveBeenCalledWith(
        'xfce4-terminal',
        [
          '-T',
          'gh-issue-preparator: test-process',
          '-e',
          "bash -c 'copilot --model gpt-5-mini --allow-all-tools -p '\\''prompt with $(whoami)'\\'''",
        ],
        {
          detached: true,
          stdio: 'ignore',
        },
      );
    });

    it('should escape single quotes in processTitle', () => {
      repository.run('prompt', 'gpt-5-mini', "title with 'quotes'");

      expect(mockSpawn).toHaveBeenCalledWith(
        'xfce4-terminal',
        [
          '-T',
          "gh-issue-preparator: title with '\\''quotes'\\''",
          '-e',
          "bash -c 'copilot --model gpt-5-mini --allow-all-tools -p '\\''prompt'\\'''",
        ],
        {
          detached: true,
          stdio: 'ignore',
        },
      );
    });

    it('should set correct window title', () => {
      repository.run('prompt', 'gpt-5-mini', 'my-custom-title');

      expect(mockSpawn).toHaveBeenCalledWith(
        'xfce4-terminal',
        expect.arrayContaining(['-T', 'gh-issue-preparator: my-custom-title']),
        expect.any(Object),
      );
    });
  });
});
