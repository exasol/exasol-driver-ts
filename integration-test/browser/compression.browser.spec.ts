import { ExasolDriver, ExasolPool, Logger, LogLevel } from '@exasol/exasol-driver-ts/browser';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { basicAuthConfig, connectionSettings, nativeWebSocketFactory, schemaName } from './browser-test-support';

// [itest->dsn~runtime-browser-websocket~2]
// [itest->dsn~decision-use-vitest-browser-mode~1]
describe('Browser compression integration', () => {
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
    if (setupDriver) {
      await setupDriver.execute(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await setupDriver.close();
    }
  });

  test('executes compressed driver and pool queries', async () => {
    setupDriver = new ExasolDriver(factory, basicAuthConfig(connection), new Logger(LogLevel.Off));
    await setupDriver.connect();
    await setupDriver.execute(`CREATE SCHEMA ${schema}`);
    await setupDriver.execute(`CREATE TABLE ${schema}.TEST_TABLE(x INT)`);
    await setupDriver.execute(`INSERT INTO ${schema}.TEST_TABLE VALUES (15)`);

    const compressedDriver = new ExasolDriver(factory, { ...basicAuthConfig(connection), compression: true }, new Logger(LogLevel.Off));
    await compressedDriver.connect();
    const result = await compressedDriver.query(`SELECT x FROM ${schema}.TEST_TABLE`);
    expect(result.getRows()).toEqual([{ X: 15 }]);
    await compressedDriver.close();

    pool = new ExasolPool(factory, {
      ...basicAuthConfig(connection),
      compression: true,
      minimumPoolSize: 1,
      maximumPoolSize: 10,
    }, new Logger(LogLevel.Off));
    const results = await Promise.all(Array.from({ length: 4 }, () => pool!.query(`SELECT x FROM ${schema}.TEST_TABLE`)));
    for (const poolResult of results) {
      expect(poolResult.getRows()).toEqual([{ X: 15 }]);
    }
  });
});
