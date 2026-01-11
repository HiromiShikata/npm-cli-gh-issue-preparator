import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { Project } from '../../domain/entities/Project';
export declare class GitHubProjectRepository implements ProjectRepository {
  private readonly token;
  constructor(token: string);
  private parseGitHubProjectUrl;
  getByUrl(url: string): Promise<Project>;
  prepareStatus(name: string, project: Project): Promise<Project>;
}
//# sourceMappingURL=GitHubProjectRepository.d.ts.map
