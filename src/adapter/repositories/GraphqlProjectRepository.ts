type ProjectV2ReadmeResponse = {
  data?: {
    organization?: {
      projectV2?: {
        readme: string | null;
      };
    };
    user?: {
      projectV2?: {
        readme: string | null;
      };
    };
  };
};

const isProjectV2ReadmeResponse = (
  value: unknown,
): value is ProjectV2ReadmeResponse =>
  typeof value === 'object' && value !== null;

export class GraphqlProjectRepository {
  constructor(private readonly token: string) {}

  async fetchReadme(projectUrl: string): Promise<string | null> {
    const { owner, projectNumber } = this.parseProjectUrl(projectUrl);

    const query = `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            readme
          }
        }
        user(login: $owner) {
          projectV2(number: $number) {
            readme
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
      console.warn('Failed to fetch project README from GitHub GraphQL API');
      return null;
    }

    const responseData: unknown = await response.json();
    if (!isProjectV2ReadmeResponse(responseData)) {
      return null;
    }

    const projectData =
      responseData.data?.organization?.projectV2 ||
      responseData.data?.user?.projectV2;

    return projectData?.readme ?? null;
  }

  private parseProjectUrl(projectUrl: string): {
    owner: string;
    projectNumber: number;
  } {
    const urlMatch = projectUrl.match(
      /github\.com\/(?:orgs|users)\/([^/]+)\/projects\/(\d+)/,
    );
    if (!urlMatch) {
      throw new Error(`Invalid GitHub project URL: ${projectUrl}`);
    }
    return {
      owner: urlMatch[1],
      projectNumber: parseInt(urlMatch[2], 10),
    };
  }
}
