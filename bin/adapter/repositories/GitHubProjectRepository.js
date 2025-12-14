"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubProjectRepository = void 0;
function isGitHubApiResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
class GitHubProjectRepository {
    constructor(token) {
        this.token = token;
    }
    parseGitHubProjectUrl(url) {
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
        const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/projects\/(\d+)/);
        if (repoMatch) {
            return {
                owner: repoMatch[1],
                projectNumber: repoMatch[3],
            };
        }
        throw new Error(`Invalid GitHub project URL: ${url}`);
    }
    async getByUrl(url) {
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
                  name
                  options {
                    name
                  }
                }
                ... on ProjectV2Field {
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
                  name
                  options {
                    name
                  }
                }
                ... on ProjectV2Field {
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
        const responseData = await response.json();
        if (!isGitHubApiResponse(responseData)) {
            throw new Error('Invalid API response format');
        }
        const result = responseData;
        const project = result.data?.organization?.projectV2 || result.data?.user?.projectV2;
        if (!project) {
            throw new Error(`Project not found: ${url}`);
        }
        const fields = project.fields.nodes;
        const statusField = fields.find((f) => f.name === 'Status');
        const statuses = statusField?.options?.map((o) => o.name) || [];
        return {
            id: project.id,
            url: project.url,
            name: project.title,
            statuses,
            customFieldNames: fields.map((f) => f.name),
        };
    }
}
exports.GitHubProjectRepository = GitHubProjectRepository;
//# sourceMappingURL=GitHubProjectRepository.js.map