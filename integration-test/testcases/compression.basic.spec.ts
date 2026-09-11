import { IntegrationTestRuntime } from './runtime';

// [itest->dsn~runtime-connect-basic-authentication~1]
// [itest->dsn~decision-share-cross-runtime-integration-scenarios~1]
export const basicCompressionTests = (runtime: IntegrationTestRuntime) => {
  const { afterEach, beforeAll, beforeEach, describe, expect, test } = runtime.api;

  describe(`${runtime.name} compression`, () => {
    let connection: Awaited<ReturnType<IntegrationTestRuntime['setup']>>['connection'];
    let factory: Awaited<ReturnType<IntegrationTestRuntime['setup']>>['factory'];
    let schemaName = '';
    let setupDriver: ReturnType<IntegrationTestRuntime['createDriver']> | undefined;
    let pool: ReturnType<IntegrationTestRuntime['createPool']> | undefined;
    const silentLogger = runtime.createSilentLogger();

    beforeAll(async () => { ({ connection, factory } = await runtime.setup()); });
    beforeEach(() => { schemaName = runtime.createSchemaName(); });
    afterEach(async () => {
      await pool?.drain();
      await pool?.clear();
      if (setupDriver) {
        await setupDriver.execute(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
        await setupDriver.close();
      }
      pool = undefined;
      setupDriver = undefined;
    });

    test('Exec and fetch', async () => {
      await createSimpleTestTable();
      const compressedDriver = runtime.createDriver(factory, { ...connection, compression: true }, silentLogger);
      await compressedDriver.connect();
      try {
        const data = await compressedDriver.query(`SELECT x FROM ${schemaName}.TEST_TABLE`);
        expect(data.getColumns()[0].name).toBe('X');
        expect(data.getRows()[0]['X']).toBe(15);
      } finally {
        await compressedDriver.close();
      }
    });

    test('Fetch multiple queries simultaneously/asynchronously', async () => {
      await createSimpleTestTable();
      pool = runtime.createPool(factory, {
        ...connection,
        compression: true,
        minimumPoolSize: 1,
        maximumPoolSize: 10,
      }, silentLogger);
      const results = await Promise.all(Array.from({ length: 4 }, () => pool!.query(`SELECT x FROM ${schemaName}.TEST_TABLE`)));
      for (const data of results) {
        expect(data.getColumns()[0].name).toBe('X');
        expect(data.getRows()[0]['X']).toBe(15);
      }
    });

    async function createSimpleTestTable() {
      setupDriver = runtime.createDriver(factory, connection, silentLogger);
      await setupDriver.connect();
      await setupDriver.execute(`CREATE SCHEMA ${schemaName}`);
      await setupDriver.execute(`CREATE TABLE ${schemaName}.TEST_TABLE(x INT)`);
      await setupDriver.execute(`INSERT INTO ${schemaName}.TEST_TABLE VALUES (15)`);
    }
  });
};
