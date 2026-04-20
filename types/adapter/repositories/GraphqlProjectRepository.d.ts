export declare class GraphqlProjectRepository {
    private readonly token;
    private readonly retryDelaysMs;
    private readonly sleep;
    constructor(token: string, retryDelaysMs?: number[], sleep?: (ms: number) => Promise<void>);
    fetchReadme(projectUrl: string): Promise<string | null>;
    private parseProjectUrl;
}
//# sourceMappingURL=GraphqlProjectRepository.d.ts.map