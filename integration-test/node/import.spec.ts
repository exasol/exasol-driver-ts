
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { StartedTestContainer } from 'testcontainers';
import { ExasolDriver, websocketFactory } from '../../src/lib/sql-client';
import { RandomUuid } from 'testcontainers/build/common/uuid';
import { startNewDockerContainer } from '../startNewDockerContainer';
import { loadCA } from '../loadCert';
import { DOCKER_CONTAINER_VERSION_LATEST } from '../runner.config';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';
import { RowSeparator } from '../../src/lib/import/types';

describe("Node Import Tests", () => {

  const randomId = new RandomUuid();
  let driver: ExasolDriver | undefined;
  let container: StartedTestContainer;
  let factory: websocketFactory;
  jest.setTimeout(7000000);
  let schemaName = '';
  let tempDirectory = '';

  beforeAll(async () => {
    container = await startNewDockerContainer(DOCKER_CONTAINER_VERSION_LATEST);
    const caString = await loadCA(container);
    factory = createWebsocketFactoryWithCertificate(caString);
  });

  beforeEach(async () => {
    schemaName = 'TEST_SCHEMA' + randomId.nextUuid();
    driver = await openConnection(factory, container);
    tempDirectory = await mkdtemp(join(tmpdir(), 'exasol-driver-ts-import-'));
  });

  async function createFile(fileName: string, fileContent: string): Promise<string> {
    const path = join(tempDirectory, fileName);
    await writeFile(path, fileContent, 'utf-8');
    return path;
  }

  it('Import from CSV', async () => {
    await driver?.execute(`CREATE SCHEMA ${schemaName}`);
    const tableName = `${schemaName}.TEST_TABLE`;
    await driver?.execute(`CREATE TABLE ${tableName} (ID DECIMAL(18,0), NAME VARCHAR(2000000))`);
    const csvContent = 'ID,NAME\n1,one\n2,two\n3,three';
    const csvFilePath = await createFile('test.csv', csvContent);
    await driver?.importFromCsvFile(tableName, csvFilePath, {
      columnDelimiter: '"',
      columnSeparator: ',',
      rowSeparator: RowSeparator.LF,
      encoding: 'UTF-8',
      skip: 1,
      //trim: 'both',
      null: 'NULL',
    });

    const data = await driver?.query(`SELECT * FROM ${tableName}`);
    expect(data?.getColumns()[0].name).toBe('ID');
    expect(data?.getColumns()[1].name).toBe('NAME');
    expect(data?.getRows()).toStrictEqual([
      { ID: 1, NAME: 'one' },
      { ID: 2, NAME: 'two' },
      { ID: 3, NAME: 'three' },
    ]);
  });

  afterEach(async () => {
    if (driver) {
      try {
        await driver.close();
      } catch (error) {
        console.warn('Could not close driver', error);
      }
    }

    try {
      if (tempDirectory) {
        await rm(tempDirectory, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Could not cleanup temp directory', tempDirectory, error);
    }

    //try {
    //  if (!factory || !container) {
    //    return;
    //  }
    //  const driver = await openConnection(factory, container);
    //  await driver.execute('DROP SCHEMA IF EXISTS ' + schemaName + ' CASCADE');
    //  await driver.close();
    //} catch (error) {
    //  console.warn('Could not cleanup schema', schemaName, error);
    //}
  });

  const openConnection = async (factory: websocketFactory, container: StartedTestContainer) => {
    const driver = new ExasolDriver(factory, {
      host: container.getHost(),
      port: container.getMappedPort(8563),
      user: 'sys',
      password: 'exasol',
      encryption: true,
    });
    await driver.connect();
    return driver;
  };
});
