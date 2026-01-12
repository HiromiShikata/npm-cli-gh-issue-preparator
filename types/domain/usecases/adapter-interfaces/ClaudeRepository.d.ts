import { ClaudeWindowUsage } from '../../entities/ClaudeWindowUsage';
export interface ClaudeRepository {
    getUsage(): Promise<ClaudeWindowUsage[]>;
}
//# sourceMappingURL=ClaudeRepository.d.ts.map