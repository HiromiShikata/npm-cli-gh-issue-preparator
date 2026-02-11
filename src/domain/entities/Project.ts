export type StoryOption = FieldOption;
export type FieldOption = {
  id: string;
  name: string;
  color:
    | 'GRAY'
    | 'BLUE'
    | 'GREEN'
    | 'YELLOW'
    | 'ORANGE'
    | 'RED'
    | 'PINK'
    | 'PURPLE';
  description: string;
};
export type Project = {
  id: string;
  url: string;
  databaseId: number;
  name: string;
  // fields: ProjectField[];
  status: {
    name: string;
    fieldId: string;
    statuses: FieldOption[];
  };
  nextActionDate: {
    name: string;
    fieldId: string;
  } | null;
  nextActionHour: {
    name: string;
    fieldId: string;
  } | null;
  story: {
    name: string;
    fieldId: string;
    databaseId: number;
    stories: FieldOption[];
    workflowManagementStory: {
      id: string;
      name: string;
    };
  } | null;
  remainingEstimationMinutes: {
    name: string;
    fieldId: string;
  } | null;
  dependedIssueUrlSeparatedByComma: {
    name: string;
    fieldId: string;
  } | null;
  completionDate50PercentConfidence: {
    name: string;
    fieldId: string;
  } | null;
};
