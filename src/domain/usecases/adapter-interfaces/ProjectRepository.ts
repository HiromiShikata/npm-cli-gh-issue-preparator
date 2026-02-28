import { Project } from '../../entities/Project';

export interface ProjectRepository {
  getByUrl(url: string): Promise<Project>;
  prepareStatus(name: string, project: Project): Promise<Project>;
  prepareCustomNumberField(
    fieldName: string,
    project: Project,
  ): Promise<Project>;
}
