import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export declare class NodeLocalCommandRunner implements LocalCommandRunner {
    runCommand(command: string): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
}
//# sourceMappingURL=NodeLocalCommandRunner.d.ts.map