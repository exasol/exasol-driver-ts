import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ExasolDriver, websocketFactory } from '../../src/lib/sql-client';
import { RandomUuid } from 'testcontainers/dist/uuid';
import { DOCKER_CONTAINER_VERSION } from '../runner.config';
import { ExasolPool, LogLevel, Logger } from '../../src';

export const basicCompressionTests = (name: string, factory: websocketFactory) =>
  describe(name, () => {
    const randomId = new RandomUuid();
    let container: StartedTestContainer;
    jest.setTimeout(7000000);
    let schemaName = '';

    beforeAll(async () => {
      container = await new GenericContainer(DOCKER_CONTAINER_VERSION)
        .withExposedPorts(8563, 2580)
        .withPrivilegedMode()
        .withDefaultLogDriver()
        .withReuse()
        .withWaitStrategy(Wait.forLogMessage('All stages finished'))
        .start();
    });

    beforeEach(() => {
      schemaName = 'TEST_SCHEMA' + randomId.nextUuid();
    });

    it('Exec and fetch', async () => {

      const setupClient = createClient(factory,container,false,LogLevel.Off)
  

      await setupClient.connect();
  
      await setupClient.execute('CREATE SCHEMA ' + schemaName);
      await setupClient.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
      await setupClient.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');

      const clientWithCompression = createClient(factory,container,true,LogLevel.Trace)
  
      await clientWithCompression.connect();
      const dataPromise1 = clientWithCompression.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');
  
  
      const data1 = await dataPromise1;
      console.log("name:" + data1.getColumns()[0].name);
      console.log("value:" + data1.getRows()[0]['X']);
  
      await clientWithCompression.close();

      await setupClient.execute('DROP SCHEMA ' + schemaName + ' CASCADE;');
      await setupClient.close();
    });
    it('Fetch multiple queries simultaneously/asynchronously', async () => {
      const setupClient = createClient(factory,container,false,LogLevel.Off)
  
      const poolToQuery = createPool(factory, container, 1, 10,true,LogLevel.Debug);
  
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
function createPool(factory: websocketFactory, container: StartedTestContainer, minimumPoolSize: number, maximumPoolSize: number,compression: boolean,logLevel: LogLevel) {
  return new ExasolPool(factory, {
    host: container.getHost(),
    port: container.getMappedPort(8563),
    user: 'sys',
    password: 'exasol',
    encryption: false,
    minimumPoolSize: minimumPoolSize,
    maximumPoolSize: maximumPoolSize,
    compression: compression
  },new Logger(logLevel) );
}
function createClient(factory: websocketFactory, container: StartedTestContainer, compression: boolean,logLevel: LogLevel) {
  return new ExasolDriver(factory, {
    host: container.getHost(),
    port: container.getMappedPort(8563),
    user: 'sys',
    password: 'exasol',
    encryption: false,
    compression: compression
  },new Logger(logLevel) );
}
