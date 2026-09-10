import { ExasolDriver, ExasolPool } from '@exasol/exasol-driver-ts/browser';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { basicAuthConfig, connectionSettings, nativeWebSocketFactory, schemaName } from './browser-test-support';

// [itest->dsn~runtime-browser-websocket~3]
// [itest->dsn~decision-use-vitest-browser-mode~1]
describe('Browser pool integration', () => {
  vi.setConfig({ testTimeout: 7_000_000 });

  const connection = connectionSettings();
  const factory = nativeWebSocketFactory().factory;
  let schema = '';
  let setupDriver: ExasolDriver | undefined;
  let pool: ExasolPool | undefined;

  beforeEach(() => {
    schema = schemaName();
  });

  afterEach(async () => {
    await pool?.drain();
    await pool?.clear();
    await setupDriver?.close().catch(() => undefined);
  });

  test('executes concurrent queries through a pool', async () => {
    setupDriver = new ExasolDriver(factory, basicAuthConfig(connection));
    await setupDriver.connect();
    await setupDriver.execute(`CREATE SCHEMA ${schema}`);
    await setupDriver.execute(`CREATE TABLE ${schema}.TEST_TABLE(x INT)`);
    await setupDriver.execute(`INSERT INTO ${schema}.TEST_TABLE VALUES (15)`);

    pool = new ExasolPool(factory, {
      ...basicAuthConfig(connection),
      minimumPoolSize: 1,
      maximumPoolSize: 10,
    });
    const results = await Promise.all(Array.from({ length: 4 }, () => pool!.query(`SELECT x FROM ${schema}.TEST_TABLE`)));
    for (const result of results) {
      expect(result.getRows()).toEqual([{ X: 15 }]);
    }
  });
});
