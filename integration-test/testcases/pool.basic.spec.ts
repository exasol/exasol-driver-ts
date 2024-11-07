import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ExasolDriver, websocketFactory } from '../../src/lib/sql-client';
import { ExasolPool } from '../../src/lib/sql-pool';
import { RandomUuid } from 'testcontainers/dist/uuid';
import { QueryResult } from '../../src/lib/query-result';

export const basicPoolTests = (name: string, factory: websocketFactory) =>
  describe(name, () => {
    const randomId = new RandomUuid();
    //let tmpDriver: ExasolClient | undefined;
    let container: StartedTestContainer;
    jest.setTimeout(7000000);
    let schemaName = '';

    beforeAll(async () => {
      container = await new GenericContainer('exasol/docker-db:7.1.22')
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

    it('Connect to DB', async () => {
      const poolToQuery = new ExasolPool(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
        min: 1,
        max: 10,
      });
      await poolToQuery.drain();
      await poolToQuery.clear();
    });

    it('Exec and fetch', async () => {
      const setupClient = new ExasolDriver(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
      });

      const poolToQuery = new ExasolPool(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
        min: 1,
        max: 10,
      });

      await setupClient.connect();

      await setupClient.execute('CREATE SCHEMA ' + schemaName);
      await setupClient.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
      await setupClient.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');

      const data = await poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

      expect(data.getColumns()[0].name).toBe('X');
      expect(data.getRows()[0]['X']).toBe(15);

      // poolToQuery.drain().then(function () {
      //   poolToQuery.clear();
      // });
      await poolToQuery.drain();
      await poolToQuery.clear();

      await setupClient.close();
    });

    it('Fetch multiple queries simultaneously/asynchronously', async () => {
      const setupClient = new ExasolDriver(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
      });

      const poolToQuery = new ExasolPool(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
        min: 1,
        max: 10,
      });

      await setupClient.connect();

      await setupClient.execute('CREATE SCHEMA ' + schemaName);
      await setupClient.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
      await setupClient.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');

      const dataPromise1 = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');
      const dataPromise2 = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');
      const dataPromise3 = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');
      const dataPromise4 = poolToQuery.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

      const data1 = await dataPromise1;
      expect(await data1.getColumns()[0].name).toBe('X');
      expect(await data1.getRows()[0]['X']).toBe(15);

      const data2 = await dataPromise2;
      expect(await data2.getColumns()[0].name).toBe('X');
      expect(await data2.getRows()[0]['X']).toBe(15);

      const data3 = await dataPromise3;
      expect(await data3.getColumns()[0].name).toBe('X');
      expect(await data3.getRows()[0]['X']).toBe(15);

      const data4 = await dataPromise4;
      expect(await data4.getColumns()[0].name).toBe('X');
      expect(await data4.getRows()[0]['X']).toBe(15);

      await poolToQuery.drain();
      await poolToQuery.clear();

      await setupClient.close();
    });

    it('Fetch multiple queries asynchronously (20)', async () => {
      const setupClient = new ExasolDriver(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
      });

      const poolToQuery = new ExasolPool(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
        min: 1,
        max: 10,
      });

      await setupClient.connect();

      await setupClient.execute('CREATE SCHEMA ' + schemaName);
      await setupClient.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
      await setupClient.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');

      const amountOfRequests = 20;

      await runQueryXNumberOfTimesAndCheckResult(amountOfRequests, poolToQuery, schemaName);

      await poolToQuery.drain();
      await poolToQuery.clear();

      await setupClient.close();
    });
    it('Fetch multiple queries asynchronously (100)', async () => {
      const setupClient = new ExasolDriver(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
      });

      const poolToQuery = new ExasolPool(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
        min: 1,
        max: 10,
      });

      await setupClient.connect();

      await setupClient.execute('CREATE SCHEMA ' + schemaName);
      await setupClient.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
      await setupClient.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');

      const amountOfRequests = 20;

      await runQueryXNumberOfTimesAndCheckResult(amountOfRequests, poolToQuery, schemaName);

      await poolToQuery.drain();
      await poolToQuery.clear();

      await setupClient.close();
    });

    afterAll(async () => {
      //  await container.stop();
    });
  });
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
