import { StartedTestContainer} from 'testcontainers';
import { ExasolDriver, websocketFactory } from '../../src/lib/sql-client';
import { RandomUuid } from 'testcontainers/build/common/uuid';
import { startNewDockerContainer } from '../startNewDockerContainer';
import { loadCA } from '../loadCert';
import { CreateWebsocketFactoryFunctionType } from './CreateWebsocketFactoryFunctionType';
import { Logger, LogLevel } from '../../src/lib/logger/logger';
import { ExasolPool } from '../../src/lib/sql-pool';

export const basicCompressionTests = (name: string, createWSFactory: CreateWebsocketFactoryFunctionType) =>
  describe(name, () => {
    const randomId = new RandomUuid();
    let container: StartedTestContainer;
    let factory: websocketFactory;
    jest.setTimeout(7000000);
    let schemaName = '';

    beforeAll(async () => {
      container = await startNewDockerContainer();
      const certString = await loadCA(container);
      factory = createWSFactory(certString);
    });

    beforeEach(() => {
      schemaName = 'TEST_SCHEMA' + randomId.nextUuid();
    });

    it('Exec and fetch', async () => {
      const setupClient = createClient(factory, container, LogLevel.Off);

      await setupClient.connect();

      await setupClient.execute('CREATE SCHEMA ' + schemaName);
      await setupClient.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
      await setupClient.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');

      const clientWithCompression = createClient(factory, container, LogLevel.Off);

      await clientWithCompression.connect();
      const dataPromise1 = clientWithCompression.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

      const data1 = await dataPromise1;
      expect(data1.getColumns()[0].name).toBe('X');
      expect(data1.getRows()[0]['X']).toBe(15);
      console.log('name:' + data1.getColumns()[0].name);
      console.log('value:' + data1.getRows()[0]['X']);

      await clientWithCompression.close();

      await setupClient.execute('DROP SCHEMA ' + schemaName + ' CASCADE;');
      await setupClient.close();
    });
    it('Fetch multiple queries simultaneously/asynchronously', async () => {
      const setupClient = createClient(factory, container, LogLevel.Off);

      const poolToQuery = createPool(factory, container, 1, 10, LogLevel.Off);

      await setupClient.connect();

      await createSimpleTestTable(setupClient, schemaName);

      const dataPromise1 = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');
      const dataPromise2 = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');
      const dataPromise3 = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');
      const dataPromise4 = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

      const data1 = await dataPromise1;
      expect(data1.getColumns()[0].name).toBe('X');
      expect(data1.getRows()[0]['X']).toBe(15);

      const data2 = await dataPromise2;
      expect(data2.getColumns()[0].name).toBe('X');
      expect(data2.getRows()[0]['X']).toBe(15);

      const data3 = await dataPromise3;
      expect(data3.getColumns()[0].name).toBe('X');
      expect(data3.getRows()[0]['X']).toBe(15);

      const data4 = await dataPromise4;
      expect(data4.getColumns()[0].name).toBe('X');
      expect(data4.getRows()[0]['X']).toBe(15);

      await poolToQuery.drain();
      await poolToQuery.clear();

      await setupClient.close();
    });

    afterAll(async () => {});
  });
async function createSimpleTestTable(setupClient: ExasolDriver, schemaName: string) {
  await setupClient.execute('CREATE SCHEMA ' + schemaName);
  await setupClient.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
  await setupClient.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');
}
function createPool(
  factory: websocketFactory,
  container: StartedTestContainer,
  minimumPoolSize: number,
  maximumPoolSize: number,
  logLevel: LogLevel,
) {
  return new ExasolPool(
    factory,
    {
      host: container.getHost(),
      port: container.getMappedPort(8563),
      user: 'sys',
      password: 'exasol',
      encryption: true,
      minimumPoolSize: minimumPoolSize,
      maximumPoolSize: maximumPoolSize,
      compression: true,
    },
    new Logger(logLevel),
  );
}
function createClient(factory: websocketFactory, container: StartedTestContainer, logLevel: LogLevel) {
  return new ExasolDriver(
    factory,
    {
      host: container.getHost(),
      port: container.getMappedPort(8563),
      user: 'sys',
      password: 'exasol',
      encryption: true,
      compression: true,
    },
    new Logger(logLevel),
  );
}
