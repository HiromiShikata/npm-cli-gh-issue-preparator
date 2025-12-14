const mockExecAsync = jest.fn();

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync),
}));

import { NodeLocalCommandRunner } from './NodeLocalCommandRunner';

describe('NodeLocalCommandRunner', () => {
  let runner: NodeLocalCommandRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    runner = new NodeLocalCommandRunner();
  });

  describe('runCommand', () => {
    it('should execute command successfully', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'command output',
        stderr: '',
      });

      const result = await runner.runCommand('echo "test"');

      expect(result).toEqual({
        stdout: 'command output',
        stderr: '',
        exitCode: 0,
      });
      expect(mockExecAsync).toHaveBeenCalledWith('echo "test"');
    });

    it('should handle command errors with exit code', async () => {
      const error = Object.assign(new Error('Command failed'), {
        code: 2,
        stdout: 'partial output',
        stderr: 'error message',
      });
      mockExecAsync.mockRejectedValue(error);

      const result = await runner.runCommand('invalid-command');

      expect(result).toEqual({
        stdout: 'partial output',
        stderr: 'error message',
        exitCode: 2,
      });
    });

    it('should default to exit code 1 when code is not a number', async () => {
      const error = Object.assign(new Error('Command failed'), {
        code: 'ENOENT',
        stdout: '',
        stderr: 'command not found',
      });
      mockExecAsync.mockRejectedValue(error);

      const result = await runner.runCommand('nonexistent');

      expect(result).toEqual({
        stdout: '',
        stderr: 'command not found',
        exitCode: 1,
      });
    });

    it('should throw error if error format is unexpected', async () => {
      mockExecAsync.mockRejectedValue(new Error('Unexpected error'));

      await expect(runner.runCommand('command')).rejects.toThrow(
        'Unexpected error',
      );
    });
  });
});
