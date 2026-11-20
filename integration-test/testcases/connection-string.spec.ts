import type { IntegrationConnectionConfig, IntegrationDriver, IntegrationTestRuntime, IntegrationWebsocketFactory } from './runtime';

/** Host names in the reserved `.invalid` top-level domain never resolve (RFC 2606). */
const UNREACHABLE_HOST = 'unreachable.invalid';

/**
 * Runs `callback` with `Math.random` returning a value close to 1, so that the driver's shuffle keeps the
 * hosts in connection string order. This makes sure the unreachable host is tried first.
 */
async function withConnectionStringOrder<T>(callback: () => Promise<T>): Promise<T> {
  const originalRandom = Math.random;
  Math.random = () => 0.999;
  try {
    return await callback();
  } finally {
    Math.random = originalRandom;
  }
}

// [itest->dsn~runtime-dsn-failover~1]
// [itest->dsn~runtime-dsn-parsing~1]
export const connectionStringTests = (runtime: IntegrationTestRuntime) => {
  const { afterEach, beforeAll, beforeEach, describe, expect, test } = runtime.api;

  describe(`${runtime.name} connection string`, () => {
    let connection: IntegrationConnectionConfig;
    let factory: IntegrationWebsocketFactory;
    let driver: IntegrationDriver | undefined;
    let urls: string[] = [];
    const recordingFactory: IntegrationWebsocketFactory = (url) => {
      urls.push(url);
      return factory(url);
    };

    beforeAll(async () => {
      ({ connection, factory } = await runtime.database.setup());
    });

    beforeEach(() => {
      urls = [];
    });

    afterEach(async () => {
      await driver?.close().catch(() => undefined);
      driver = undefined;
    });

    test('connects via the reachable host after trying an unreachable host', async () => {
      driver = runtime.driver.create(recordingFactory, {
        ...connection,
        host: `${UNREACHABLE_HOST},${connection.host}:${connection.port}`,
        port: 1,
      });
      await withConnectionStringOrder(() => driver!.connect());
      const result = await driver.query('SELECT 1 AS X');
      expect(result.getRows()).toEqual([{ X: 1 }]);
      expect(urls).toEqual([`wss://${UNREACHABLE_HOST}:${connection.port}`, `wss://${connection.host}:${connection.port}`]);
    });

    test('pool connects via the reachable host after trying an unreachable host', async () => {
      const pool = runtime.pool.create(recordingFactory, {
        ...connection,
        host: `${UNREACHABLE_HOST},${connection.host}:${connection.port}`,
      });
      try {
        const result = await withConnectionStringOrder(() => pool.query('SELECT 1 AS X'));
        expect(result.getRows()).toEqual([{ X: 1 }]);
        expect(urls).toEqual([`wss://${UNREACHABLE_HOST}:${connection.port}`, `wss://${connection.host}:${connection.port}`]);
      } finally {
        await pool.drain();
        await pool.clear();
      }
    });

    test('lists every host when no host of the connection string is reachable', async () => {
      driver = runtime.driver.create(
        recordingFactory,
        { ...connection, host: `unreachable1..2.invalid:${connection.port}` },
        runtime.driver.createSilentLogger(),
      );
      await withConnectionStringOrder(() =>
        expect(driver!.connect()).rejects.toThrow(
          `E-EDJS-42: Could not connect to Exasol. Tried '2' host(s): 'wss://unreachable1.invalid:${connection.port}: `,
        ),
      );
      expect(urls).toEqual([`wss://unreachable1.invalid:${connection.port}`, `wss://unreachable2.invalid:${connection.port}`]);
    });
  });
};
