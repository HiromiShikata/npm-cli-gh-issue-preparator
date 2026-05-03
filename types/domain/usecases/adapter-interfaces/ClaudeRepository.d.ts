import { ClaudeWindowUsage } from '../../entities/ClaudeWindowUsage';
export interface ClaudeRepository {
  getUsage(): Promise<ClaudeWindowUsage[]>;
  isClaudeAvailable(threshold: number): Promise<boolean>;
}
//# sourceMappingURL=ClaudeRepository.d.ts.map
