import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
export declare class OauthAPIClaudeRepository implements ClaudeRepository {
    private readonly credentialsPath;
    constructor();
    private getAccessToken;
    getUsage(): Promise<ClaudeWindowUsage[]>;
}
//# sourceMappingURL=OauthAPIClaudeRepository.d.ts.map