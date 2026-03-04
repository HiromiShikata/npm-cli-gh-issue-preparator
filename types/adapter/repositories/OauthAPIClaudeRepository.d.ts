import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
export declare class OauthAPIClaudeRepository implements ClaudeRepository {
    private readonly credentialsPath;
    private readonly claudeDir;
    constructor();
    private getAccessToken;
    getUsage(): Promise<ClaudeWindowUsage[]>;
    private getUsageWithToken;
    private isUsageUnderThreshold;
    isClaudeAvailable(threshold: number): Promise<boolean>;
}
//# sourceMappingURL=OauthAPIClaudeRepository.d.ts.map