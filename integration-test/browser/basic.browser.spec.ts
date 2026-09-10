import { ExasolDriver, driverVersion } from '@exasol/exasol-driver-ts/browser';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { basicAuthConfig, connectionSettings, nativeWebSocketFactory, schemaName } from './browser-test-support';

// [itest->dsn~runtime-browser-websocket~3]
// [itest->dsn~decision-use-vitest-browser-mode~1]
describe('Browser basic integration', () => {
  vi.setConfig({ testTimeout: 7_000_000 });

  const connection = connectionSettings();
  const nativeWebSocket = nativeWebSocketFactory();
  const factory = nativeWebSocket.factory;
  let schema = '';
  let driver: ExasolDriver | undefined;

  beforeEach(() => {
    schema = schemaName();
    nativeWebSocket.urls.length = 0;
  });

  afterEach(async () => {
    await driver?.close().catch(() => undefined);
    const cleanupDriver = new ExasolDriver(factory, basicAuthConfig(connection));
    try {
      await cleanupDriver.connect();
      await cleanupDriver.execute(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await cleanupDriver.close().catch(() => undefined);
    }
  });

  test('connects through the native wss WebSocket', async () => {
    driver = new ExasolDriver(factory, basicAuthConfig(connection));
    await driver.connect();
    expect(driver).toBeDefined();
    expect(nativeWebSocket.urls).toEqual([`wss://${connection.host}:${connection.port}`]);
  });

  test('connects through an explicit wss URL', async () => {
    driver = new ExasolDriver(factory, {
      ...basicAuthConfig(connection),
      url: `wss://${connection.host}:${connection.port}`,
    });
    await driver.connect();
    expect(driver).toBeDefined();
  });

  test('executes and fetches a query', async () => {
    driver = new ExasolDriver(factory, basicAuthConfig(connection));
    await driver.connect();
    await driver.execute(`CREATE SCHEMA ${schema}`);
    await driver.execute(`CREATE TABLE ${schema}.TEST_TABLE(x INT)`);
    await driver.execute(`INSERT INTO ${schema}.TEST_TABLE VALUES (15)`);

    const result = await driver.query(`SELECT x FROM ${schema}.TEST_TABLE`);
    expect(result.getColumns()[0].name).toBe('X');
    expect(result.getRows()).toEqual([{ X: 15 }]);
  });

  test('stores the default browser login metadata', async () => {
    driver = new ExasolDriver(factory, basicAuthConfig(connection));
    await driver.connect();

    const session = await driver.query('SELECT CLIENT, DRIVER, OS_NAME FROM EXA_DBA_SESSIONS WHERE SESSION_ID = CURRENT_SESSION');
    expect(session.getRows()).toEqual([{
      CLIENT: 'Javascript client 1',
      DRIVER: expect.stringMatching(new RegExp(`^exasol-driver-ts ${driverVersion.replace(/\./g, '\\.')}\\s*$`)),
      OS_NAME: expect.stringMatching(/.+/),
    }]);
  });

  test('cancels a running query', async () => {
    driver = new ExasolDriver(factory, basicAuthConfig(connection));
    await driver.connect();
    const query = driver.query('select "$SLEEP"(5)');
    await new Promise(resolve => setTimeout(resolve, 500));
    await driver.cancel();
    await expect(query).rejects.toThrow("E-EDJS-25: SQL error: code: 'R0003', message: 'Client requested execution abort.");
  });
});
