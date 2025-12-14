module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/adapter-interfaces/**',
  ],
  coverageDirectory: 'reports/coverage',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports/jest-junit' }],
    [
      './node_modules/jest-html-reporter',
      { outputPath: 'reports/jest-html-reporter/index.html' },
    ],
  ],
  testPathIgnorePatterns: ['/node_modules/', '/bin/', '/dist/'],
};
