import { ExasolDriver, ExasolPool, Logger, LogLevel, driverVersion } from '@exasol/exasol-driver-ts/browser';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { IntegrationTestRuntime, TestApi } from '../testcases/runtime';
import { basicAuthConfig, connectionSettings, nativeWebSocketFactory, schemaName } from './browser-test-support';

// [impl->dsn~decision-share-cross-runtime-integration-scenarios~1]
/** Integration test setup for the browser / Vitest */
export function createBrowserRuntime(): IntegrationTestRuntime {
  let websocketFactory: ReturnType<typeof nativeWebSocketFactory> | undefined;
  return {
    name: 'Browser',
    api: { describe, test: test as TestApi['test'], beforeAll, beforeEach, afterEach, expect },
    database: {
      setup: async () => {
        const connection = connectionSettings();
        websocketFactory = nativeWebSocketFactory();
        return { connection: basicAuthConfig(connection), factory: websocketFactory.factory };
      },
      createSchemaName: schemaName,
    },
    driver: {
      expectedName: new RegExp(`^exasol-driver-ts ${driverVersion.replace(/\./g, '\\.')}\\s*$`),
      expectedDefaultOsName: /.+/,
      createSilentLogger: () => new Logger(LogLevel.Off),
      create: (factory, config, logger) => new ExasolDriver(factory, config, logger),
    },
    pool: { create: (factory, config, logger) => new ExasolPool(factory, config, logger) },
    websocket: {
      waitForLatestClose: () => websocketFactory?.waitForClose() ?? Promise.resolve(),
      isLatestClosed: () => websocketFactory?.isClosed() ?? false,
    },
  };
}
