export declare class GraphqlProjectRepository {
  private readonly token;
  constructor(token: string);
  fetchReadme(projectUrl: string): Promise<string | null>;
  private parseProjectUrl;
}
//# sourceMappingURL=GraphqlProjectRepository.d.ts.map
