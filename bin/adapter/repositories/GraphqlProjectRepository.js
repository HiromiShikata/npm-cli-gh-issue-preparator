"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlProjectRepository = void 0;
const isProjectV2ReadmeResponse = (value) => typeof value === 'object' && value !== null;
class GraphqlProjectRepository {
    constructor(token) {
        this.token = token;
    }
    async fetchReadme(projectUrl) {
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
        const responseData = await response.json();
        if (!isProjectV2ReadmeResponse(responseData)) {
            return null;
        }
        const projectData = responseData.data?.organization?.projectV2 ||
            responseData.data?.user?.projectV2;
        return projectData?.readme ?? null;
    }
    parseProjectUrl(projectUrl) {
        const urlMatch = projectUrl.match(/github\.com\/(?:orgs|users)\/([^/]+)\/projects\/(\d+)/);
        if (!urlMatch) {
            throw new Error(`Invalid GitHub project URL: ${projectUrl}`);
        }
        return {
            owner: urlMatch[1],
            projectNumber: parseInt(urlMatch[2], 10),
        };
    }
}
exports.GraphqlProjectRepository = GraphqlProjectRepository;
//# sourceMappingURL=GraphqlProjectRepository.js.map