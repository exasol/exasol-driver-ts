import type { IntegrationConnectionConfig, IntegrationTestRuntime, IntegrationWebsocketFactory } from './runtime';

export const resourceManagementTests = (runtime: IntegrationTestRuntime) => {
  const { beforeAll, describe, expect, test } = runtime.api;

  describe(`${runtime.name} explicit resource management`, () => {
    let connection: IntegrationConnectionConfig;
    let factory: IntegrationWebsocketFactory;

    beforeAll(async () => { ({ connection, factory } = await runtime.database.setup()); });

    // [itest->dsn~runtime-driver-async-disposal~1]
    test('closes a connected driver when leaving an await using scope', async () => {
      let closed: Promise<void>;
      {
        await using driver = runtime.driver.create(factory, connection);
        await driver.connect();
        closed = runtime.websocket.waitForLatestClose();
      }

      await closed!;
      expect(runtime.websocket.isLatestClosed()).toBe(true);
    });

    // [itest->dsn~runtime-pool-async-disposal~1]
    test('drains and clears a pool when leaving an await using scope', async () => {
      let closed: Promise<void>;
      {
        await using pool = runtime.pool.create(factory, { ...connection, minimumPoolSize: 0, maximumPoolSize: 1 });
        await pool.query('SELECT 1');
        closed = runtime.websocket.waitForLatestClose();
      }

      await closed!;
      expect(runtime.websocket.isLatestClosed()).toBe(true);
    });
  });
};
