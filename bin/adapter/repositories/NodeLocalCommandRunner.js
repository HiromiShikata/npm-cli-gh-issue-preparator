"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeLocalCommandRunner = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class NodeLocalCommandRunner {
    async runCommand(command) {
        try {
            const { stdout, stderr } = await execAsync(command);
            return {
                stdout,
                stderr,
                exitCode: 0,
            };
        }
        catch (error) {
            if (error &&
                typeof error === 'object' &&
                'stdout' in error &&
                'stderr' in error &&
                'code' in error) {
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
exports.NodeLocalCommandRunner = NodeLocalCommandRunner;
//# sourceMappingURL=NodeLocalCommandRunner.js.map