import { IntegrationTestRuntime } from './runtime';

// [itest->dsn~runtime-pool-capacity-management~1]
// [itest->dsn~runtime-pooled-query-execution~1]
// [itest->dsn~runtime-pool-shutdown~1]
// [itest->dsn~decision-share-cross-runtime-integration-scenarios~1]
export const basicPoolTests = (runtime: IntegrationTestRuntime) => {
  const { afterEach, beforeAll, beforeEach, describe, expect, test } = runtime.api;

  describe(`${runtime.name} pool`, () => {
    let connection: Awaited<ReturnType<IntegrationTestRuntime['setup']>>['connection'];
    let factory: Awaited<ReturnType<IntegrationTestRuntime['setup']>>['factory'];
    let schemaName = '';
    let setupDriver: ReturnType<IntegrationTestRuntime['createDriver']> | undefined;
    let pool: ReturnType<IntegrationTestRuntime['createPool']> | undefined;

    beforeAll(async () => { ({ connection, factory } = await runtime.setup()); });
    beforeEach(() => { schemaName = runtime.createSchemaName(); });
    afterEach(async () => {
      if (!connection || !factory) {
        return;
      }
      await pool?.drain();
      await pool?.clear();
      await setupDriver?.close().catch(() => undefined);
      pool = undefined;
      setupDriver = undefined;
      const cleanupDriver = runtime.createDriver(factory, connection);
      try {
        await cleanupDriver.connect();
        await cleanupDriver.execute(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      } finally {
        await cleanupDriver.close().catch(() => undefined);
      }
    });

    test('Connect to DB', async () => {
      pool = createPool(1, 10);
      expect(pool).toBeDefined();
    });

    test('Exec and fetch (default min / max connection settings)', async () => {
      pool = runtime.createPool(factory, connection);
      await createSimpleTestTable();
      await expectSingleResult(pool);
    });

    test('Exec and fetch', async () => {
      pool = createPool(1, 10);
      await createSimpleTestTable();
      await expectSingleResult(pool);
    });

    test('Fetch multiple queries simultaneously/asynchronously', async () => {
      pool = createPool(1, 10);
      await createSimpleTestTable();
      await expectQueryCount(pool, 4);
    });

    test('Fetch multiple queries asynchronously (20)', async () => {
      pool = createPool(1, 10);
      await createSimpleTestTable();
      await expectQueryCount(pool, 20);
    });

    test('Fetch multiple queries asynchronously (100)', async () => {
      pool = createPool(1, 10);
      await createSimpleTestTable();
      await expectQueryCount(pool, 100);
    });

    function createPool(minimumPoolSize: number, maximumPoolSize: number) {
      return runtime.createPool(factory, { ...connection, minimumPoolSize, maximumPoolSize });
    }

    async function createSimpleTestTable() {
      setupDriver = runtime.createDriver(factory, connection);
      await setupDriver.connect();
      await setupDriver.execute(`CREATE SCHEMA ${schemaName}`);
      await setupDriver.execute(`CREATE TABLE ${schemaName}.TEST_TABLE(x INT)`);
      await setupDriver.execute(`INSERT INTO ${schemaName}.TEST_TABLE VALUES (15)`);
    }

    async function expectSingleResult(poolToQuery: ReturnType<IntegrationTestRuntime['createPool']>) {
      const data = await poolToQuery.query(`SELECT x FROM ${schemaName}.TEST_TABLE`);
      expect(data.getColumns()[0].name).toBe('X');
      expect(data.getRows()[0]['X']).toBe(15);
    }

    async function expectQueryCount(poolToQuery: ReturnType<IntegrationTestRuntime['createPool']>, queryCount: number) {
      const results = await Promise.all(Array.from({ length: queryCount }, () => poolToQuery.query(`SELECT x FROM ${schemaName}.TEST_TABLE`)));
      for (const data of results) {
        expect(data.getColumns()[0].name).toBe('X');
        expect(data.getRows()[0]['X']).toBe(15);
      }
    }
  });
};
