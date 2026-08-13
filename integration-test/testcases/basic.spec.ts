import { RandomUuid } from 'testcontainers/build/common/uuid';
import { ExasolDriver, WebsocketFactory } from '../../src/lib/sql-client';
import { TestEnvironment, TestWebsocketFactory } from '../common';
import { ExasolContainer, startNewDockerContainer } from '../exasolContainer';

// [itest->dsn~runtime-connect-basic-authentication~1]
// [itest->dsn~runtime-browser-websocket~1]
// [itest->dsn~runtime-node-websocket~1]
export const basicTests = (name: TestEnvironment, createWSFactory: TestWebsocketFactory) =>
  describe(name, () => {

    const randomId = new RandomUuid();
    let tmpDriver: ExasolDriver | undefined;
    let container: ExasolContainer;
    let factory: WebsocketFactory;
    jest.setTimeout(7000000);
    let schemaName = '';

    beforeAll(async () => {
      container = await startNewDockerContainer();
      const caString = await container.loadCA();
      factory = createWSFactory(caString);
    });

    beforeEach(() => {
      schemaName = 'TEST_SCHEMA' + randomId.nextUuid();
    });

    it('Connect to DB', async () => {
      const driver = await openConnection();
      expect(driver).toBeDefined();
      await driver.close();
    });

    it('Connect to DB via URL', async () => {
      const url = `wss://${container.getHost()}:${container.getPort()}`;
      const driver = await openConnection(url, 'invalidHost', 1);
      expect(driver).toBeDefined();
      await driver.close();
    });


    describe('query()', () => {
      // [itest->dsn~runtime-query-execution~2]
      it('Exec and fetch', async () => {
        const driver = await openConnection();

        await driver.execute('CREATE SCHEMA ' + schemaName);
        await driver.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
        await driver.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');
        const data = await driver.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

        expect(data.getColumns()[0].name).toBe('X');
        expect(data.getRows()[0]['X']).toBe(15);

        await driver.close();
      });

      it('Fetch', async () => {
        const driver = await openConnection();

        await driver.execute('CREATE SCHEMA ' + schemaName);
        await driver.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
        const exampleData: string[] = [];

        for (let index = 0; index < 10000; index++) {
          exampleData.push(`(${index})`);
        }

        await driver.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES ' + exampleData.join(','));
        const data = await driver.query('SELECT x FROM ' + schemaName + '.TEST_TABLE GROUP BY x ORDER BY x');

        expect(data.getRows()).toHaveLength(10000);
        await driver.close();
      });

      it('Cancel long running query', async () => {
        // [itest->dsn~runtime-query-cancellation~1]
        const driver = await openConnection();

        const startedAt = Date.now();
        const queryPromise = driver.query('select "$SLEEP"(5)');
        await new Promise((resolve) => setTimeout(resolve, 500));

        await driver.cancel();
        await expect(queryPromise).rejects.toThrow("E-EDJS-25: SQL error: code: 'R0003', message: 'Client requested execution abort.");

        expect(Date.now() - startedAt).toBeLessThan(3000);
        await driver.close();
      });
    });

    describe('execute()', () => {
      // [itest->dsn~runtime-command-execution~1]
      it('Exec and fetch (raw)', async () => {
        // [itest->dsn~runtime-raw-response-execution~1]
        const driver = await openConnection();

        await driver.execute('CREATE SCHEMA ' + schemaName, undefined, undefined, 'raw');
        await driver.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
        await driver.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');

        const data = await driver.execute('SELECT x FROM ' + schemaName + '.TEST_TABLE', undefined, undefined, 'raw');

        expect(data.status).toBe('ok');
        expect(data.responseData.numResults).toBe(1);
        expect(data.responseData.results[0].resultType).toBe('resultSet');
        expect(data.responseData.results[0].resultSet?.data![0][0]).toBe(15);

        await driver.close();
      });


      it('Cancel long running statement', async () => {
        // [itest->dsn~runtime-query-cancellation~1]
        const driver = await openConnection();

        const startedAt = Date.now();
        const executePromise = driver.execute('select "$SLEEP"(5)');
        await new Promise((resolve) => setTimeout(resolve, 500));

        await driver.cancel();
        await expect(executePromise).rejects.toThrow("E-EDJS-25: SQL error: code: 'R0003', message: 'Client requested execution abort.");

        expect(Date.now() - startedAt).toBeLessThan(3000);
        await driver.close();
      });
    });

    afterEach(async () => {
      if (tmpDriver) {
        try {
          await tmpDriver?.close();
        } catch (error) {
          console.warn('Could not close driver', error);
        }
      }

      try {
        const driver = await openConnection();
        await driver.execute('DROP SCHEMA IF EXISTS ' + schemaName + ' CASCADE');
        await driver.close();
      } catch (error) {
        console.warn('Could not cleanup schema', schemaName, error);
      }
    });

    const openConnection = async (url?: string, host = container.getHost(), port = container.getPort()) => {
      expect(factory).toBeDefined();
      expect(container).toBeDefined();
      const driver = new ExasolDriver(factory, {
        host,
        port,
        url,
        user: 'sys',
        password: 'exasol'
      });
      await driver.connect();
      tmpDriver = driver;
      return driver;
    };
  });
