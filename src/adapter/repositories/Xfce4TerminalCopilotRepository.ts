import { CopilotRepository } from '../../domain/usecases/adapter-interfaces/CopilotRepository';
import { spawn } from 'child_process';

export class Xfce4TerminalCopilotRepository implements CopilotRepository {
  private escapeForSingleQuotes(str: string): string {
    return str.replace(/'/g, "'\\''");
  }

  run(prompt: string, model: 'gpt-5-mini', processTitle: string): void {
    const escapedPrompt = this.escapeForSingleQuotes(prompt);
    const escapedTitle = this.escapeForSingleQuotes(processTitle);
    const innerCommand = `copilot --model ${model} --allow-all-tools -p '${escapedPrompt}'`;
    const escapedInnerCommand = this.escapeForSingleQuotes(innerCommand);
    const title = `gh-issue-preparator: ${escapedTitle}`;

    spawn(
      'xfce4-terminal',
      ['-T', title, '-e', `bash -c '${escapedInnerCommand}'`],
      {
        detached: true,
        stdio: 'ignore',
      },
    ).unref();
  }
}
