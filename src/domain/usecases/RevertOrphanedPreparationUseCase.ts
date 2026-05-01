import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';

export class RevertOrphanedPreparationUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'prepareStatus'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllOpened' | 'update'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'createComment'
    >,
    private readonly localCommandRunner: LocalCommandRunner,
  ) {}

  run = async (params: {
    projectUrl: string;
    preparationStatus: string;
    awaitingWorkspaceStatus: string;
    preparationProcessCheckCommand: string;
  }): Promise<void> => {
    let project = await this.projectRepository.getByUrl(params.projectUrl);
    project = await this.projectRepository.prepareStatus(
      params.preparationStatus,
      project,
    );
    project = await this.projectRepository.prepareStatus(
      params.awaitingWorkspaceStatus,
      project,
    );

    const issues = await this.issueRepository.getAllOpened(project);
    const preparationIssues = issues.filter(
      (issue) => issue.status === params.preparationStatus,
    );

    for (const issue of preparationIssues) {
      const command = params.preparationProcessCheckCommand.replace(
        '{URL}',
        issue.url,
      );
      const { exitCode } = await this.localCommandRunner.runCommand(command);
      if (exitCode !== 0) {
        issue.status = params.awaitingWorkspaceStatus;
        await this.issueRepository.update(issue, project);
        await this.issueCommentRepository.createComment(
          issue,
          `Reverted from ${params.preparationStatus} to ${params.awaitingWorkspaceStatus}: no live worker process found for this issue (check command exited with code ${exitCode}).`,
        );
      }
    }
  };
}
