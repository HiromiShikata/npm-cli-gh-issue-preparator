import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class NodeLocalCommandRunner implements LocalCommandRunner {
  async runCommand(
    program: string,
    args: string[],
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    try {
      const { stdout, stderr } = await execFileAsync(program, args);
      return {
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'stdout' in error &&
        'stderr' in error &&
        'code' in error
      ) {
        return {
          stdout: String(error.stdout),
          stderr: String(error.stderr),
          exitCode: typeof error.code === 'number' ? error.code : 1,
        };
      }
      throw error;
    }
  }
}
