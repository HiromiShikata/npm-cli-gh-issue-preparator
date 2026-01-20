import { Project } from '../../entities/Project';
export interface ProjectRepository {
    getByUrl(url: string): Promise<Project>;
}
//# sourceMappingURL=ProjectRepository.d.ts.map