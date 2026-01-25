export type Project = {
  id: string;
  url: string;
  name: string;
  statuses: string[];
  customFieldNames: string[];
  statusFieldId: string | null;
};
