import { IntegrationTestRuntime } from './runtime';

export const resourceManagementTests = (runtime: IntegrationTestRuntime) => {
  const { beforeAll, describe, test } = runtime.api;

  describe(`${runtime.name} explicit resource management`, () => {
    let connection: Awaited<ReturnType<IntegrationTestRuntime['setup']>>['connection'];
    let factory: Awaited<ReturnType<IntegrationTestRuntime['setup']>>['factory'];

    beforeAll(async () => { ({ connection, factory } = await runtime.setup()); });

    // [itest->dsn~runtime-driver-async-disposal~1]
    test('closes a connected driver when leaving an await using scope', async () => {
      let closed: Promise<void>;
      {
        await using driver = runtime.createDriver(factory, connection);
        await driver.connect();
        closed = runtime.waitForLatestWebSocketClose();
      }

      await closed!;
    });

    // [itest->dsn~runtime-pool-async-disposal~1]
    test('drains and clears a pool when leaving an await using scope', async () => {
      let closed: Promise<void>;
      {
        await using pool = runtime.createPool(factory, { ...connection, minimumPoolSize: 0, maximumPoolSize: 1 });
        await pool.query('SELECT 1');
        closed = runtime.waitForLatestWebSocketClose();
      }

      await closed!;
    });
  });
};
