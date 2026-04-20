type GraphqlError = {
  type?: string;
  code?: string;
  message: string;
};

type ProjectV2ReadmeResponse = {
  data?: {
    organization?: {
      projectV2?: {
        readme: string | null;
      };
    } | null;
    user?: {
      projectV2?: {
        readme: string | null;
      };
    } | null;
  };
  errors?: Array<GraphqlError>;
};

const isProjectV2ReadmeResponse = (
  value: unknown,
): value is ProjectV2ReadmeResponse => {
  if (typeof value !== 'object' || value === null) return false;
  if (Array.isArray(value)) return false;
  if (
    'data' in value &&
    value.data !== undefined &&
    value.data !== null &&
    typeof value.data !== 'object'
  )
    return false;
  return true;
};

const isRateLimitError = (errors: GraphqlError[]): boolean =>
  errors.some(
    (e) =>
      e.type === 'RATE_LIMIT' ||
      e.code === 'graphql_rate_limit' ||
      e.message.toLowerCase().includes('rate limit'),
  );

export class GraphqlProjectRepository {
  private readonly retryDelaysMs: number[];
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly token: string,
    retryDelaysMs: number[] = [5000, 15000, 45000],
    sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.retryDelaysMs = retryDelaysMs;
    this.sleep = sleep;
  }

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

    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelaysMs[attempt - 1];
        console.log(
          `Rate limited fetching project README, retrying in ${delay / 1000}s... (attempt ${attempt}/${this.retryDelaysMs.length})`,
        );
        await this.sleep(delay);
      }

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

      if (response.status === 429) {
        if (attempt < this.retryDelaysMs.length) continue;
        console.warn(
          'Rate limit exceeded fetching project README, all retries exhausted',
        );
        return null;
      }

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

      if (responseData.errors && responseData.errors.length > 0) {
        if (isRateLimitError(responseData.errors) && !projectData) {
          if (attempt < this.retryDelaysMs.length) continue;
          console.warn(
            `Rate limited fetching project README, all retries exhausted: ${JSON.stringify(responseData.errors)}`,
          );
          return null;
        }
        if (!projectData) {
          console.warn(
            `GraphQL errors in project README response: ${JSON.stringify(responseData.errors)}`,
          );
          return null;
        }
      }

      return projectData?.readme ?? null;
    }

    return null;
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
