export interface LocalCommandRunner {
  runCommand(
    program: string,
    args: string[],
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}
//# sourceMappingURL=LocalCommandRunner.d.ts.map