import { randomUUID } from 'node:crypto';
import packageMetadata from '../../package.json';
import { WebSocket } from 'ws';
import { ExasolPool } from '../../src/lib/exasol-pool';
import { ExaWebsocket } from '../../src/lib/connection';
import { Logger, LogLevel } from '../../src/lib/logger/logger';
import { ExasolDriver } from '../../src/lib/sql-client';
import { startNewDockerContainer } from '../exasolContainer';
import { IntegrationTestRuntime, TestApi } from '../testcases/runtime';

// [impl->dsn~decision-share-cross-runtime-integration-scenarios~1]
/** Integration test setup for Node.js / Jest */
export function createNodeRuntime(): IntegrationTestRuntime {
  let websocket: WebSocket | undefined;
  jest.setTimeout(7_000_000);
  return {
    name: 'Node',
    api: { describe, test: it as TestApi['test'], beforeAll, beforeEach, afterEach, expect },
    setup: async () => {
      const container = await startNewDockerContainer();
      const ca = await container.loadCA();
      return {
        connection: { host: container.getHost(), port: container.getPort(), user: 'sys', password: 'exasol' },
        factory: (url) => {
          websocket = new WebSocket(url, { rejectUnauthorized: true, ca, checkServerIdentity: () => false });
          return websocket as ExaWebsocket;
        },
      };
    },
    createSchemaName: () => `TEST_SCHEMA${randomUUID().replace(/-/g, '')}`,
    expectedDriverName: new RegExp(`^exasol-driver-ts v${packageMetadata.version.replace(/\./g, '\\.')}\\s*$`),
    expectedDefaultOsName: new RegExp(`^${process.platform} ${process.arch}$`),
    createSilentLogger: () => new Logger(LogLevel.Off),
    waitForLatestWebSocketClose: () => {
      if (!websocket || websocket.readyState === WebSocket.CLOSED) {
        return Promise.resolve();
      }
      return new Promise(resolve => websocket?.once('close', () => resolve()));
    },
    isLatestWebSocketClosed: () => websocket?.readyState === WebSocket.CLOSED,
    createDriver: (factory, config, logger) => new ExasolDriver(factory, config, logger),
    createPool: (factory, config, logger) => new ExasolPool(factory, config, logger),
  };
}
