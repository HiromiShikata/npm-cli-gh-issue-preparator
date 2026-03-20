import { Project } from './Project';
import { StoryOption } from 'github-issue-tower-defence-management/src/domain/entities/Project';
import { Issue } from 'github-issue-tower-defence-management/src/domain/entities/Issue';
export type StoryObject = {
  story: StoryOption;
  storyIssue: Issue | null;
  issues: Issue[];
};
export type StoryObjectMap = Map<
  NonNullable<Project['story']>['stories'][0]['name'],
  StoryObject
>;
//# sourceMappingURL=StoryObjectMap.d.ts.map
