import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'unit-dom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.spec.dom.ts'],
      transform: {
        '^.+\\.[tj]s$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.spec.dom.json',
            isolatedModules: false,
            diagnostics: true,
          },
        ],
      },
    },
    {
      displayName: 'unit-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.spec.node.ts'],
      transform: {
        '^.+\\.[tj]s$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.spec.json',
            isolatedModules: false,
            diagnostics: true,
          },
        ],
      },
    },
    {
      displayName: 'itest-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/integration-test/node/**/*.spec.ts'],
      transform: {
        '^.+\\.[tj]s$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.spec.json',
            isolatedModules: false,
            diagnostics: true,
          },
        ],
      },
    },
    {
      displayName: 'itest-dom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/integration-test/browser/**/*.spec.ts'],
      transform: {
        '^.+\\.[tj]s$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.spec.dom.json',
            isolatedModules: false,
            diagnostics: true,
          },
        ],
      },
    },
  ],
  displayName: 'exasol-driver',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        isolatedModules: false,
        diagnostics: true,
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*.mjs$)'],
  preset: './jest.preset.js',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: './coverage/exasol-driver',
};

export default config;
