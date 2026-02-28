import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { Project } from '../../domain/entities/Project';
export declare class TowerDefenceProjectRepository implements ProjectRepository {
  private readonly configFilePath;
  private readonly _token;
  private cachedProject;
  private projectUrl;
  constructor(configFilePath: string, _token: string);
  private loadProject;
  getByUrl(url: string): Promise<Project>;
  prepareStatus(_name: string, project: Project): Promise<Project>;
  private mapToProject;
  prepareCustomNumberField(
    _fieldName: string,
    project: Project,
  ): Promise<Project>;
}
//# sourceMappingURL=TowerDefenceProjectRepository.d.ts.map
