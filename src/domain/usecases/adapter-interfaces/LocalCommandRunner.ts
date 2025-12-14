export interface LocalCommandRunner {
  runCommand(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}
