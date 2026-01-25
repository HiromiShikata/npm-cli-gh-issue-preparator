import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { Project } from '../../domain/entities/Project';

type GitHubProjectField = {
  id?: string;
  name: string;
  options?: Array<{ name: string }>;
};

type GitHubProjectV2 = {
  id: string;
  title: string;
  url: string;
  fields: {
    nodes: GitHubProjectField[];
  };
};

type GitHubApiResponse = {
  data?: {
    organization?: {
      projectV2?: GitHubProjectV2;
    };
    user?: {
      projectV2?: GitHubProjectV2;
    };
  };
};

function isGitHubApiResponse(value: unknown): value is GitHubApiResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

export class GitHubProjectRepository implements ProjectRepository {
  constructor(private readonly token: string) {}

  private parseGitHubProjectUrl(url: string): {
    owner: string;
    projectNumber: string;
  } {
    const orgMatch = url.match(/github\.com\/orgs\/([^/]+)\/projects\/(\d+)/);
    if (orgMatch) {
      return {
        owner: orgMatch[1],
        projectNumber: orgMatch[2],
      };
    }

    const userMatch = url.match(/github\.com\/users\/([^/]+)\/projects\/(\d+)/);
    if (userMatch) {
      return {
        owner: userMatch[1],
        projectNumber: userMatch[2],
      };
    }

    const repoMatch = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/projects\/(\d+)/,
    );
    if (repoMatch) {
      return {
        owner: repoMatch[1],
        projectNumber: repoMatch[3],
      };
    }

    throw new Error(`Invalid GitHub project URL: ${url}`);
  }

  async getByUrl(url: string): Promise<Project> {
    const { owner, projectNumber } = this.parseGitHubProjectUrl(url);

    const projectQuery = `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            title
            url
            fields(first: 100) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    name
                  }
                }
                ... on ProjectV2Field {
                  id
                  name
                }
              }
            }
          }
        }
        user(login: $owner) {
          projectV2(number: $number) {
            id
            title
            url
            fields(first: 100) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    name
                  }
                }
                ... on ProjectV2Field {
                  id
                  name
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
        query: projectQuery,
        variables: {
          owner,
          number: parseInt(projectNumber, 10),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${errorText}`);
    }

    const responseData: unknown = await response.json();
    if (!isGitHubApiResponse(responseData)) {
      throw new Error('Invalid API response format');
    }

    const result: GitHubApiResponse = responseData;
    const project =
      result.data?.organization?.projectV2 || result.data?.user?.projectV2;
    if (!project) {
      throw new Error(`Project not found: ${url}`);
    }

    const fields = project.fields.nodes;
    const statusField = fields.find((f) => f.name === 'Status');
    const statuses: string[] = statusField?.options?.map((o) => o.name) || [];

    return {
      id: project.id,
      url: project.url,
      name: project.title,
      statuses,
      customFieldNames: fields.map((f) => f.name),
      statusFieldId: statusField?.id ?? null,
    };
  }

  async prepareStatus(name: string, project: Project): Promise<Project> {
    if (project.statuses.includes(name)) {
      return project;
    }

    if (!project.statusFieldId) {
      throw new Error(
        `Status field not found in project "${project.name}". ` +
          `Cannot add status "${name}".`,
      );
    }

    const existingOptions = project.statuses.map((statusName) => ({
      name: statusName,
      color: 'GRAY',
      description: '',
    }));

    const newOptions = [
      ...existingOptions,
      { name, color: 'GRAY', description: '' },
    ];

    const mutation = `
      mutation($fieldId: ID!, $singleSelectOptions: [ProjectV2SingleSelectFieldOptionInput!]!) {
        updateProjectV2Field(input: {
          fieldId: $fieldId
          singleSelectOptions: $singleSelectOptions
        }) {
          projectV2Field {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                name
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
        query: mutation,
        variables: {
          fieldId: project.statusFieldId,
          singleSelectOptions: newOptions,
        },
      }),
    });

    const responseData: unknown = await response.json();

    if (!isGitHubApiResponse(responseData)) {
      throw new Error('Invalid API response format');
    }

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

    return {
      ...project,
      statuses: [...project.statuses, name],
    };
  }
}
