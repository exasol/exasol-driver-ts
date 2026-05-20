
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
import { CsvFormatOptions, RowSeparator, TrimMode } from '../../src/lib/import/types';
import { IExasolDriver } from '../../src/lib/sql-client.interface';

describe("Node Import", () => {

  const randomId = new RandomUuid();
  let driver: IExasolDriver;
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
  });

  async function createFile(fileName: string, fileContent: string): Promise<string> {
    const path = join(tempDirectory, fileName);
    await writeFile(path, fileContent, { encoding: 'utf-8' });
    return path;
  }

  describe('importFromCsvFile', () => {
    it('fails import when target table does not exist', async () => {
      const tableName = 'MISSING_TABLE';
      const csvContent = '1,one\n2,two\n3,three';
      const csvFilePath = await createFile('test.csv', csvContent);
      await expect(driver?.importFromCsvFile(tableName, csvFilePath, {})).rejects.toThrow(`E-EDJS-25: SQL error: code: '42000', message: 'object MISSING_TABLE not found`);
    });

    it('imports CSV file into table', async () => {
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

    describe('supports various options', () => {
      interface ImportTestCase {
        description: string;
        csvContent: string;
        csvOptions: CsvFormatOptions;
        expectedRows: unknown[];
      }
      const defaultExpectedRows = [{ ID: 1, NAME: 'one' }, { ID: 2, NAME: 'two' }, { ID: 3, NAME: 'three' }];
      const testCases: ImportTestCase[] = [{
        description: 'default options', csvOptions: {},
        csvContent: '1,one\n2,two\n3,three',
        expectedRows: defaultExpectedRows
      },
      {
        description: 'custom column delimiter', csvOptions: { columnDelimiter: "'" },
        csvContent: "1,'one'\n2,'two'\n3,'three'",
        expectedRows: defaultExpectedRows
      },
      {
        description: 'custom column separator', csvOptions: { columnSeparator: ";" },
        csvContent: "1;one\n2;two\n3;three",
        expectedRows: defaultExpectedRows
      },
      {
        description: 'custom row separator', csvOptions: { rowSeparator: RowSeparator.CRLF },
        csvContent: "1,one\r\n2,two\r\n3,three",
        expectedRows: defaultExpectedRows
      },
      {
        description: 'skip header row', csvOptions: { skip: 1 },
        csvContent: "ignored header row\n1,one\n2,two\n3,three",
        expectedRows: defaultExpectedRows
      },
      {
        description: 'custom encoding', csvOptions: { encoding: 'ASCII' },
        csvContent: "1,one\n2,two\n3,three",
        expectedRows: defaultExpectedRows
      },
      {
        description: 'custom null value', csvOptions: { null: 'CUSTOM_NULL_VALUE' },
        csvContent: "1,one\n2,two\n3,CUSTOM_NULL_VALUE",
        expectedRows: [{ ID: 1, NAME: 'one' }, { ID: 2, NAME: 'two' }, { ID: 3, NAME: null }]
      },
      {
        description: 'trim left / leading whitespace', csvOptions: { trim: TrimMode.LEADING },
        csvContent: "1, one\n2,\ttwo\n3,three ",
        expectedRows: [{ ID: 1, NAME: 'one' }, { ID: 2, NAME: '\ttwo' }, { ID: 3, NAME: 'three ' }]
      },
      {
        description: 'trim right / trailing whitespace', csvOptions: { trim: TrimMode.TRAILING },
        csvContent: "1,one \n2,two\t\n3, three",
        expectedRows: [{ ID: 1, NAME: 'one' }, { ID: 2, NAME: 'two\t' }, { ID: 3, NAME: ' three' }]
      },
      {
        description: 'trim both', csvOptions: { trim: TrimMode.BOTH },
        csvContent: "1, one \n2,\ttwo\t\n3,three",
        expectedRows: [{ ID: 1, NAME: 'one' }, { ID: 2, NAME: '\ttwo\t' }, { ID: 3, NAME: 'three' }]
      },
      {
        description: 'do not trim', csvOptions: { trim: TrimMode.NONE },
        csvContent: "1, one \n2,\ttwo\t\n3,three",
        expectedRows: [{ ID: 1, NAME: ' one ' }, { ID: 2, NAME: '\ttwo\t' }, { ID: 3, NAME: 'three' }]
      }]

      testCases.forEach(({ description, csvContent, csvOptions, expectedRows }) => {
        it(`imports CSV file into table with ${description}`, async () => {
          await driver?.execute(`CREATE SCHEMA ${schemaName}`);
          const tableName = `${schemaName}.TEST_TABLE`;
          await driver?.execute(`CREATE TABLE ${tableName} (ID DECIMAL(18,0), NAME VARCHAR(2000000))`);
          const csvFilePath = await createFile('test.csv', csvContent);
          await driver?.importFromCsvFile(tableName, csvFilePath, csvOptions);

          const data = await driver?.query(`SELECT * FROM ${tableName}`);
          expect(data?.getRows()).toStrictEqual(expectedRows);
        });
      });

    });
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
