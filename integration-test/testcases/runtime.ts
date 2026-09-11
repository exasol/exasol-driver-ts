import type { ClientPoolConfig } from '../../src/lib/exasol-pool';
import type { ILogger } from '../../src/lib/logger/logger';
import type { Config, WebsocketFactory } from '../../src/lib/sql-client';

export type TestEnvironment = 'Node' | 'Browser';
export type IntegrationConnectionConfig = Partial<Config>;
export type IntegrationWebsocketFactory = WebsocketFactory;

export interface IntegrationTestSetup {
  connection: IntegrationConnectionConfig;
  factory: IntegrationWebsocketFactory;
}

type TestCallback = () => void | Promise<void>;

/**
 * Abstracts the testing API for integration tests to allow using both Jest (Node.js) and Vitest (Browser).
 * This allows running the same test suite in both Node.js and browser environments.
 */
export interface TestApi {
  describe: (name: string, callback: TestCallback) => void;
  test: (name: string, callback: TestCallback) => void;
  beforeAll: (callback: TestCallback) => void;
  beforeEach: (callback: TestCallback) => void;
  afterEach: (callback: TestCallback) => void;
  expect: {
    (actual: unknown): {
      toBe: (expected: unknown) => void;
      toBeDefined: () => void;
      toEqual: (expected: unknown) => void;
      toHaveLength: (expected: number) => void;
      toBeLessThan: (expected: number) => void;
      rejects: { toThrow: (expected: string) => Promise<void> };
    };
    stringMatching: (expected: RegExp) => unknown;
  };
}

export interface IntegrationDriver {
  [Symbol.asyncDispose]: () => Promise<void>;
  connect: () => Promise<void>;
  close: () => Promise<void>;
  cancel: () => Promise<void>;
  query: (statement: string) => Promise<IntegrationQueryResult>;
  execute: {
    (statement: string): Promise<unknown>;
    (statement: string, attributes: undefined, getCancel: undefined, responseType: 'raw'): Promise<IntegrationRawResponse>;
  };
}

export interface IntegrationPool {
  [Symbol.asyncDispose]: () => Promise<void>;
  query: (statement: string) => Promise<IntegrationQueryResult>;
  drain: () => Promise<void>;
  clear: () => Promise<void>;
}

export interface IntegrationQueryResult {
  getColumns: () => Array<{ name: string }>;
  getRows: () => Array<Record<string, unknown>>;
}

interface IntegrationRawResponse {
  status: string;
  responseData: {
    numResults: number;
    results: Array<{ resultType: string; resultSet?: { data?: unknown[][] } }>;
  };
}

/** Interface for integration test runtime environments browser (vitest) and Node.js (jest) */
export interface IntegrationTestRuntime {
  name: TestEnvironment;
  api: TestApi;
  database: {
    setup: () => Promise<IntegrationTestSetup>;
    createSchemaName: () => string;
  };
  driver: {
    expectedName: RegExp;
    expectedDefaultOsName: RegExp;
    create: (factory: IntegrationWebsocketFactory, config: IntegrationConnectionConfig, logger?: ILogger) => IntegrationDriver;
    createSilentLogger: () => ILogger;
  };
  pool: {
    create: (factory: IntegrationWebsocketFactory, config: IntegrationConnectionConfig & Partial<ClientPoolConfig>, logger?: ILogger) => IntegrationPool;
  };
  websocket: {
    waitForLatestClose: () => Promise<void>;
    isLatestClosed: () => boolean;
  };
}
