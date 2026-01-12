"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Xfce4TerminalCopilotRepository = void 0;
const child_process_1 = require("child_process");
class Xfce4TerminalCopilotRepository {
    escapeForSingleQuotes(str) {
        return str.replace(/'/g, "'\\''");
    }
    run(prompt, model, processTitle) {
        const escapedPrompt = this.escapeForSingleQuotes(prompt);
        const escapedTitle = this.escapeForSingleQuotes(processTitle);
        const innerCommand = `copilot --model ${model} --allow-all-tools -p '${escapedPrompt}'`;
        const escapedInnerCommand = this.escapeForSingleQuotes(innerCommand);
        const title = `gh-issue-preparator: ${escapedTitle}`;
        const child = (0, child_process_1.spawn)('xfce4-terminal', ['-T', title, '-e', `bash -c '${escapedInnerCommand}'`], {
            detached: true,
            stdio: 'ignore',
        });
        child.on('error', () => {
            // Intentionally empty - fire-and-forget behavior
            // Errors are silently ignored as this is a background terminal spawn
        });
        child.unref();
    }
}
exports.Xfce4TerminalCopilotRepository = Xfce4TerminalCopilotRepository;
//# sourceMappingURL=Xfce4TerminalCopilotRepository.js.map