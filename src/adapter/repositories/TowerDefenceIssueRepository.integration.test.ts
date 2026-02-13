import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { TowerDefenceIssueRepository } from './TowerDefenceIssueRepository';

dotenv.config();

describe('TowerDefenceIssueRepository Integration Tests', () => {
  const projectUrl = 'https://github.com/users/HiromiShikata/projects/49';
  const configFilePath = path.join(
    __dirname,
    '../../../tmp/test-tower-defence-config.yml',
  );
  let repository: TowerDefenceIssueRepository;

  beforeAll(() => {
    const ghToken = process.env.GH_TOKEN;
    if (!ghToken) {
      throw new Error('GH_TOKEN environment variable is required');
    }

    const tmpDir = path.dirname(configFilePath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const configContent = `org: HiromiShikata
projectUrl: ${projectUrl}
projectName: test-project
manager: HiromiShikata
allowIssueCacheMinutes: 0
credentials:
  ghToken: ${ghToken}
  bot:
    github:
      token: ${ghToken}
workingReport:
  repo: test-repository
  members:
    - HiromiShikata
  spreadsheetUrl: https://docs.google.com/spreadsheets/d/test
  reportIssueLabels:
    - report
`;
    fs.writeFileSync(configFilePath, configContent);

    repository = new TowerDefenceIssueRepository(configFilePath, ghToken);
  });

  afterAll(() => {
    if (fs.existsSync(configFilePath)) {
      fs.unlinkSync(configFilePath);
    }
  });

  const createMockProject = () => ({
    id: 'test-project-id',
    url: projectUrl,
    databaseId: 49,
    name: 'test-project',
    status: {
      name: 'Status',
      fieldId: 'field-1',
      statuses: [],
    },
    nextActionDate: null,
    nextActionHour: null,
    story: null,
    remainingEstimationMinutes: null,
    dependedIssueUrlSeparatedByComma: null,
    completionDate50PercentConfidence: null,
  });

  describe('getAllOpened', () => {
    it('should return open issues from project', async () => {
      const project = createMockProject();

      const result = await repository.getAllOpened(project);

      expect(Array.isArray(result)).toBe(true);
      for (const issue of result) {
        expect(issue).toHaveProperty('url');
        expect(issue).toHaveProperty('title');
        expect(issue).toHaveProperty('state');
        expect(issue.state).toBe('OPEN');
      }
    });
  });

  describe('getStoryObjectMap', () => {
    it('should return story object map from project', async () => {
      const project = createMockProject();

      const result = await repository.getStoryObjectMap(project);

      expect(result).toBeInstanceOf(Map);
      // The map should have story names as keys
      for (const [storyName, storyObject] of result) {
        expect(typeof storyName).toBe('string');
        expect(storyObject).toHaveProperty('story');
        expect(storyObject).toHaveProperty('issues');
        expect(Array.isArray(storyObject.issues)).toBe(true);
      }
    });
  });
});
