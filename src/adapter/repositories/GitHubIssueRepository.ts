import { IssueRepository } from '../../domain/usecases/adapter-interfaces/IssueRepository';
import { Issue } from '../../domain/entities/Issue';
import { Project } from '../../domain/entities/Project';

type ProjectItem = {
  id: string;
  content: {
    url: string;
    title: string;
    number: number;
    labels: {
      nodes: Array<{ name: string }>;
    };
  };
  fieldValues?: {
    nodes: Array<{
      name?: string;
      field?: {
        name?: string;
      };
    }>;
  };
};

type ProjectItemsResponse = {
  data?: {
    organization?: {
      projectV2?: {
        items: {
          nodes: ProjectItem[];
        };
      };
    };
    user?: {
      projectV2?: {
        items: {
          nodes: ProjectItem[];
        };
      };
    };
  };
};

type UpdateItemResponse = {
  data?: {
    updateProjectV2ItemFieldValue?: {
      projectV2Item: {
        id: string;
      };
    };
  };
};

type StatusFieldOption = {
  id: string;
  name: string;
};

type StatusField = {
  id: string;
  name: string;
  options: StatusFieldOption[];
};

type StatusFieldsResponse = {
  data?: {
    organization?: {
      projectV2?: {
        fields: {
          nodes: StatusField[];
        };
      };
    };
    user?: {
      projectV2?: {
        fields: {
          nodes: StatusField[];
        };
      };
    };
  };
};

function isProjectItemsResponse(value: unknown): value is ProjectItemsResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

function isUpdateItemResponse(value: unknown): value is UpdateItemResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

function isStatusFieldsResponse(value: unknown): value is StatusFieldsResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

export class GitHubIssueRepository implements IssueRepository {
  constructor(private readonly token: string) {}

  private parseProjectInfo(project: Project): {
    owner: string;
    projectNumber: number;
  } {
    const urlMatch = project.url.match(
      /github\.com\/(?:orgs|users)\/([^/]+)\/projects\/(\d+)/,
    );
    if (!urlMatch) {
      throw new Error(`Invalid GitHub project URL: ${project.url}`);
    }
    const owner = urlMatch[1];
    const projectNumber = parseInt(urlMatch[2], 10);

    return { owner, projectNumber };
  }

  private buildProjectItemsQuery(): string {
    return `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    url
                    title
                    number
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field {
                        ... on ProjectV2Field {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        user(login: $owner) {
          projectV2(number: $number) {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    url
                    title
                    number
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field {
                        ... on ProjectV2Field {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
  }

  private async getStatusOptionId(
    project: Project,
    statusName: string,
  ): Promise<{ fieldId: string; optionId: string } | null> {
    const { owner, projectNumber } = this.parseProjectInfo(project);

    const query = `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            fields(first: 10) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
        user(login: $owner) {
          projectV2(number: $number) {
            fields(first: 10) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          owner,
          number: projectNumber,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const responseData: unknown = await response.json();
    if (!isStatusFieldsResponse(responseData)) {
      return null;
    }

    const result: StatusFieldsResponse = responseData;
    const fields =
      result.data?.organization?.projectV2?.fields.nodes ||
      result.data?.user?.projectV2?.fields.nodes ||
      [];

    const statusField = fields.find((f) => f.name === 'Status');
    if (!statusField) {
      return null;
    }

    const option = statusField.options.find((o) => o.name === statusName);
    if (!option) {
      return null;
    }

    return {
      fieldId: statusField.id,
      optionId: option.id,
    };
  }

  async getAllOpened(project: Project): Promise<Issue[]> {
    const { owner, projectNumber } = this.parseProjectInfo(project);

    const query = this.buildProjectItemsQuery();

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          owner,
          number: projectNumber,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${errorText}`);
    }

    const responseData: unknown = await response.json();
    if (!isProjectItemsResponse(responseData)) {
      throw new Error('Invalid API response format');
    }

    const result: ProjectItemsResponse = responseData;
    const items =
      result.data?.organization?.projectV2?.items.nodes ||
      result.data?.user?.projectV2?.items.nodes ||
      [];

    const issues: Issue[] = [];
    for (const item of items) {
      if (!item.content) continue;

      const statusField = item.fieldValues?.nodes.find(
        (fv) => fv.field?.name === 'Status',
      );
      const status = statusField?.name || '';

      issues.push({
        id: item.id,
        url: item.content.url,
        title: item.content.title,
        labels: item.content.labels.nodes.map((l) => l.name),
        status,
      });
    }

    return issues;
  }

  async update(issue: Issue, project: Project): Promise<void> {
    const statusInfo = await this.getStatusOptionId(project, issue.status);
    if (!statusInfo) {
      throw new Error(`Status option not found for status: ${issue.status}`);
    }

    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: $value
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          projectId: project.id,
          itemId: issue.id,
          fieldId: statusInfo.fieldId,
          value: { singleSelectOptionId: statusInfo.optionId },
        },
      }),
    });

    const responseData: unknown = await response.json();

    if (!response.ok) {
      throw new Error(`GitHub API error: ${JSON.stringify(responseData)}`);
    }

    if (
      typeof responseData === 'object' &&
      responseData !== null &&
      'errors' in responseData
    ) {
      throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
    }

    if (!isUpdateItemResponse(responseData)) {
      throw new Error('Invalid API response format');
    }
  }

  async get(issueUrl: string, project: Project): Promise<Issue | null> {
    const { owner, projectNumber } = this.parseProjectInfo(project);

    const query = this.buildProjectItemsQuery();

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          owner,
          number: projectNumber,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const responseData: unknown = await response.json();
    if (!isProjectItemsResponse(responseData)) {
      return null;
    }

    const result: ProjectItemsResponse = responseData;
    const items =
      result.data?.organization?.projectV2?.items.nodes ||
      result.data?.user?.projectV2?.items.nodes ||
      [];

    for (const item of items) {
      if (!item.content) continue;

      if (item.content.url === issueUrl) {
        const statusField = item.fieldValues?.nodes.find(
          (fv) => fv.field?.name === 'Status',
        );
        const status = statusField?.name || '';

        return {
          id: item.id,
          url: item.content.url,
          title: item.content.title,
          labels: item.content.labels.nodes.map((l) => l.name),
          status,
        };
      }
    }

    return null;
  }
}
