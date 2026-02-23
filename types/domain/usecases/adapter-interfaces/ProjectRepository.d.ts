import { Project } from '../../entities/Project';
export interface ProjectRepository {
    getByUrl(url: string): Promise<Project>;
    prepareStatus(name: string, project: Project): Promise<Project>;
}
//# sourceMappingURL=ProjectRepository.d.ts.map