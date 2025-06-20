import { StartedTestContainer} from 'testcontainers';
import { ExasolDriver, websocketFactory } from '../../src/lib/sql-client';
import { RandomUuid } from 'testcontainers/build/common/uuid';
import { startNewDockerContainer } from '../startNewDockerContainer';
import { loadCA } from '../loadCert';
import { CreateWebsocketFactoryFunctionType } from './CreateWebsocketFactoryFunctionType';

export const basicTests = (name: string, createWSFactory: CreateWebsocketFactoryFunctionType, dockerDbVersion: string, useEncryption: boolean) =>
  describe(name, () => {

    const randomId = new RandomUuid();
    let tmpDriver: ExasolDriver | undefined;
    let container: StartedTestContainer;
    let factory: websocketFactory;
    jest.setTimeout(7000000);
    let schemaName = '';
  

    beforeAll(async () => {
      container = await startNewDockerContainer(dockerDbVersion);
      const caString = await loadCA(container);
      factory = createWSFactory(caString);
    });

    beforeEach(() => {
      schemaName = 'TEST_SCHEMA' + randomId.nextUuid();
    });

    it('Connect to DB', async () => {
      const driver = await openConnection(factory, container);
      await driver.close();
    });

    it('Exec and fetch', async () => {
      const driver = await openConnection(factory, container);

      await driver.execute('CREATE SCHEMA ' + schemaName);
      await driver.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
      await driver.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');
      const data = await driver.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

      expect(data.getColumns()[0].name).toBe('X');
      expect(data.getRows()[0]['X']).toBe(15);

      await driver.close();
    });

    it('Exec and fetch (raw)', async () => {
      const driver = await openConnection(factory, container);

      await driver.execute('CREATE SCHEMA ' + schemaName, undefined, undefined, 'raw');
      await driver.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
      await driver.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');

      const data = await driver.execute('SELECT x FROM ' + schemaName + '.TEST_TABLE', undefined, undefined, 'raw');

      expect(data.status).toBe('ok');
      expect(data.responseData.numResults).toBe(1);
      expect(data.responseData.results[0].resultType).toBe('resultSet');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(data.responseData.results[0].resultSet?.data![0][0]).toBe(15);

      await driver.close();
    });

    it('Fetch', async () => {
      const driver = await openConnection(factory, container);

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

    afterEach(async () => {
      if (tmpDriver) {
        try {
          await tmpDriver?.close();
        } catch (error) {
          console.log('Could not close driver');
        }
      }

      try {
        const driver = await openConnection(factory, container);
        await driver.execute('DROP SCHEMA IF EXISTS ' + schemaName + ' CASCADE');
        await driver.close();
      } catch (error) {
        console.log('Could not cleanup schema', schemaName);
      }
    });

    afterAll(async () => {
      //  await container.stop();
    });

    const openConnection = async (factory: websocketFactory, container: StartedTestContainer) => {
      const driver = new ExasolDriver(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: useEncryption,
      });
      await driver.connect();
      tmpDriver = driver;
      return driver;
    };

  });