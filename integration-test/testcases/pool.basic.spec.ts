import { StartedTestContainer} from 'testcontainers';
import { ExasolDriver, websocketFactory } from '../../src/lib/sql-client';
import { RandomUuid } from 'testcontainers/build/common/uuid';
import { startNewDockerContainer } from '../startNewDockerContainer';
import { loadCA } from '../loadCert';
import { CreateWebsocketFactoryFunctionType } from './CreateWebsocketFactoryFunctionType';
import { QueryResult } from '../../src/lib/query-result';
import { ExasolPool } from '../../src/lib/sql-pool';


export const basicPoolTests = (name: string, createWSFactory: CreateWebsocketFactoryFunctionType)  =>
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

    it('Connect to DB', async () => {
      const poolToQuery = createPool(factory, container, 1, 10);
      await poolToQuery.drain();
      await poolToQuery.clear();
    });

    it('Exec and fetch (default min / max connection settings)', async () => {
      const setupClient = createSetupClient(factory, container);

      const poolToQuery = createPoolWithDefaultSize(factory, container);

      await setupClient.connect();

      await createSimpleTestTable(setupClient, schemaName);

      const data = await poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

      expect(data.getColumns()[0].name).toBe('X');
      expect(data.getRows()[0]['X']).toBe(15);

      await poolToQuery.drain();
      await poolToQuery.clear();

      await setupClient.close();
    });

    it('Exec and fetch', async () => {
      const setupClient = createSetupClient(factory, container);

      const poolToQuery = createPool(factory, container, 1, 10);

      await setupClient.connect();

      await createSimpleTestTable(setupClient, schemaName);

      const data = await poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

      expect(data.getColumns()[0].name).toBe('X');
      expect(data.getRows()[0]['X']).toBe(15);

      await poolToQuery.drain();
      await poolToQuery.clear();

      await setupClient.close();
    });

    it('Fetch multiple queries simultaneously/asynchronously', async () => {
      const setupClient = createSetupClient(factory, container);

      const poolToQuery = createPool(factory, container, 1, 10);

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

    it('Fetch multiple queries asynchronously (20)', async () => {
      const setupClient = createSetupClient(factory, container);

      const poolToQuery = createPool(factory, container, 1, 10);

      await setupClient.connect();

      await createSimpleTestTable(setupClient, schemaName);

      const amountOfRequests = 20;

      await runQueryXNumberOfTimesAndCheckResult(amountOfRequests, poolToQuery, schemaName);

      await poolToQuery.drain();
      await poolToQuery.clear();

      await setupClient.close();
    });
    it('Fetch multiple queries asynchronously (100)', async () => {
      const setupClient = createSetupClient(factory, container);

      const poolToQuery = createPool(factory, container, 1, 10);

      await setupClient.connect();

      await createSimpleTestTable(setupClient, schemaName);

      const amountOfRequests = 100;

      await runQueryXNumberOfTimesAndCheckResult(amountOfRequests, poolToQuery, schemaName);

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

function createSetupClient(factory: websocketFactory, container: StartedTestContainer) {
  return new ExasolDriver(factory, {
    host: container.getHost(),
    port: container.getMappedPort(8563),
    user: 'sys',
    password: 'exasol',
    encryption: true,
  });
}

function createPoolWithDefaultSize(factory: websocketFactory, container: StartedTestContainer) {
  return new ExasolPool(factory, {
    host: container.getHost(),
    port: container.getMappedPort(8563),
    user: 'sys',
    password: 'exasol',
    encryption: true,
  });
}

function createPool(factory: websocketFactory, container: StartedTestContainer, minimumPoolSize: number, maximumPoolSize: number) {
  return new ExasolPool(factory, {
    host: container.getHost(),
    port: container.getMappedPort(8563),
    user: 'sys',
    password: 'exasol',
    encryption: true,
    minimumPoolSize: minimumPoolSize,
    maximumPoolSize: maximumPoolSize,
  });
}

async function runQueryXNumberOfTimesAndCheckResult(amountOfRequests: number, poolToQuery: ExasolPool, schemaName: string) {
  const promiseArr: Promise<QueryResult>[] = [];

  for (let i = 0; i < amountOfRequests; i++) {
    const dataPromise = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');
    promiseArr.push(dataPromise);
  }

  await Promise.all(promiseArr);

  for (let i = 0; i < amountOfRequests; i++) {
    const data = await promiseArr[i];
    expect(data.getColumns()[0].name).toBe('X');
    expect(data.getRows()[0]['X']).toBe(15);
  }
}
