import type { IntegrationConnectionConfig, IntegrationDriver, IntegrationTestRuntime, IntegrationWebsocketFactory } from './runtime';

// [itest->dsn~runtime-connect-basic-authentication~1]
// [itest->dsn~runtime-browser-websocket~2]
// [itest->dsn~runtime-node-websocket~2]
// [itest->dsn~decision-share-cross-runtime-integration-scenarios~1]
export const basicTests = (runtime: IntegrationTestRuntime) => {
  const { afterEach, beforeAll, beforeEach, describe, expect, test } = runtime.api;

  describe(runtime.name, () => {
    let connection: IntegrationConnectionConfig;
    let factory: IntegrationWebsocketFactory;
    let tmpDriver: IntegrationDriver | undefined;
    let schemaName = '';

    beforeAll(async () => { ({ connection, factory } = await runtime.database.setup()); });
    beforeEach(() => { schemaName = runtime.database.createSchemaName(); });

    test('Connect to DB', async () => {
      const driver = await openConnection();
      expect(driver).toBeDefined();
      await driver.close();
    });

    test('Connect to DB via URL', async () => {
      const driver = await openConnection(`wss://${connection.host}:${connection.port}`, 'invalidHost', 1);
      expect(driver).toBeDefined();
      await driver.close();
    });

    // [itest->dsn~runtime-login-metadata~1]
    test('stores configured login metadata in the session table', async () => {
      const driver = runtime.driver.create(factory, {
        ...connection,
        clientName: 'exasol-driver-ts-integration-test',
        clientOs: 'configured operating system',
        clientOsUsername: 'configured user',
        clientRuntime: 'configured runtime',
      });
      await driver.connect();
      tmpDriver = driver;
      const session = await driver.query('SELECT CLIENT, DRIVER, OS_NAME, OS_USER FROM EXA_DBA_SESSIONS WHERE SESSION_ID = CURRENT_SESSION');
      expect(session.getRows()).toEqual([{
        CLIENT: 'exasol-driver-ts-integration-test 1',
        DRIVER: expect.stringMatching(runtime.driver.expectedName),
        OS_NAME: 'configured operating system',
        OS_USER: 'configured user',
      }]);
    });

    // [itest->dsn~runtime-login-metadata~1]
    test('stores default login metadata in the session table', async () => {
      const driver = runtime.driver.create(factory, connection);
      await driver.connect();
      tmpDriver = driver;
      const session = await driver.query('SELECT CLIENT, DRIVER, OS_NAME FROM EXA_DBA_SESSIONS WHERE SESSION_ID = CURRENT_SESSION');
      expect(session.getRows()).toEqual([{
        CLIENT: 'Javascript client 1',
        DRIVER: expect.stringMatching(runtime.driver.expectedName),
        OS_NAME: expect.stringMatching(runtime.driver.expectedDefaultOsName),
      }]);
    });

    describe('query()', () => {
      // [itest->dsn~runtime-query-execution~3]
      test('Exec and fetch', async () => {
        const driver = await openConnection();
        await createSimpleTestTable(driver);
        const data = await driver.query(`SELECT x FROM ${schemaName}.TEST_TABLE`);
        expect(data.getColumns()[0].name).toBe('X');
        expect(data.getRows()[0]['X']).toBe(15);
      });

      test('Fetch', async () => {
        const driver = await openConnection();
        await driver.execute(`CREATE SCHEMA ${schemaName}`);
        await driver.execute(`CREATE TABLE ${schemaName}.TEST_TABLE(x INT)`);
        const values = Array.from({ length: 10_000 }, (_, index) => `(${index})`);
        await driver.execute(`INSERT INTO ${schemaName}.TEST_TABLE VALUES ${values.join(',')}`);
        const data = await driver.query(`SELECT x FROM ${schemaName}.TEST_TABLE GROUP BY x ORDER BY x`);
        expect(data.getRows()).toHaveLength(10_000);
      });

      test('reuses a pooled connection after fetching a multi-block result set', async () => {
        const driver = await openConnection();
        const pool = runtime.pool.create(factory, { ...connection, minimumPoolSize: 1, maximumPoolSize: 1 });
        try {
          await driver.execute(`CREATE SCHEMA ${schemaName}`);
          await driver.execute(`CREATE TABLE ${schemaName}.TEST_TABLE(x INT)`);
          const values = Array.from({ length: 2000 }, (_, index) => `(${index})`);
          await driver.execute(`INSERT INTO ${schemaName}.TEST_TABLE VALUES ${values.join(',')}`);
          const firstResult = await pool.query(`SELECT x FROM ${schemaName}.TEST_TABLE ORDER BY x`);
          const secondResult = await pool.query(`SELECT x FROM ${schemaName}.TEST_TABLE ORDER BY x`);
          expect(firstResult.getRows()).toHaveLength(2000);
          expect(secondResult.getRows()).toHaveLength(2000);
        } finally {
          await pool.drain();
          await pool.clear();
        }
      });

      test('Cancel long running query', async () => {
        // [itest->dsn~runtime-query-cancellation~1]
        const driver = await openConnection();
        const startedAt = Date.now();
        const queryPromise = driver.query('select "$SLEEP"(5)');
        await new Promise(resolve => setTimeout(resolve, 500));
        await driver.cancel();
        await expect(queryPromise).rejects.toThrow("E-EDJS-25: SQL error: code: 'R0003', message: 'Client requested execution abort.");
        expect(Date.now() - startedAt).toBeLessThan(3000);
      });
    });

    describe('execute()', () => {
      // [itest->dsn~runtime-command-execution~1]
      test('Exec and fetch (raw)', async () => {
        // [itest->dsn~runtime-raw-response-execution~1]
        const driver = await openConnection();
        await driver.execute(`CREATE SCHEMA ${schemaName}`, undefined, undefined, 'raw');
        await driver.execute(`CREATE TABLE ${schemaName}.TEST_TABLE(x INT)`);
        await driver.execute(`INSERT INTO ${schemaName}.TEST_TABLE VALUES (15)`);
        const data = await driver.execute(`SELECT x FROM ${schemaName}.TEST_TABLE`, undefined, undefined, 'raw');
        expect(data.status).toBe('ok');
        expect(data.responseData.numResults).toBe(1);
        expect(data.responseData.results[0].resultType).toBe('resultSet');
        expect(data.responseData.results[0].resultSet?.data![0][0]).toBe(15);
      });

      test('Cancel long running statement', async () => {
        // [itest->dsn~runtime-query-cancellation~1]
        const driver = await openConnection();
        const startedAt = Date.now();
        const executePromise = driver.execute('select "$SLEEP"(5)');
        await new Promise(resolve => setTimeout(resolve, 500));
        await driver.cancel();
        await expect(executePromise).rejects.toThrow("E-EDJS-25: SQL error: code: 'R0003', message: 'Client requested execution abort.");
        expect(Date.now() - startedAt).toBeLessThan(3000);
      });
    });

    afterEach(async () => {
      if (!connection || !factory) {
        return;
      }
      await tmpDriver?.close().catch(error => console.warn('Could not close driver', error));
      tmpDriver = undefined;
      const cleanupDriver = runtime.driver.create(factory, connection, runtime.driver.createSilentLogger());
      try {
        await cleanupDriver.connect();
        await cleanupDriver.execute(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      } catch (error) {
        console.warn('Could not cleanup schema', schemaName, error);
      } finally {
        await cleanupDriver.close().catch(() => undefined);
      }
    });

    async function openConnection(url?: string, host = connection.host, port = connection.port) {
      const driver = runtime.driver.create(factory, { ...connection, host, port, url });
      await driver.connect();
      tmpDriver = driver;
      return driver;
    }

    async function createSimpleTestTable(driver: IntegrationDriver) {
      await driver.execute(`CREATE SCHEMA ${schemaName}`);
      await driver.execute(`CREATE TABLE ${schemaName}.TEST_TABLE(x INT)`);
      await driver.execute(`INSERT INTO ${schemaName}.TEST_TABLE VALUES (15)`);
    }
  });
};
