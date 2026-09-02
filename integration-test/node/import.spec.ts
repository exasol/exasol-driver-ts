
import { execFile } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { RandomUuid } from 'testcontainers/build/common/uuid';
import { CsvFormatOptions, RowSeparator, TrimMode } from '../../src/lib/import/types';
import { ExasolDriver, WebsocketFactory } from '../../src/lib/sql-client';
import { IExasolDriver } from '../../src/lib/sql-client.interface';
import { ExasolContainer, startNewDockerContainer } from '../exasolContainer';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';

const describeImportWhenSupported = ExasolContainer.supportsEncryptedImportExport() ? describe : describe.skip;
const describeParquetImportWhenSupported = ExasolContainer.supportsParquetImport() ? describe : describe.skip;
const describeParquetImportWhenUnsupported = ExasolContainer.supportsEncryptedImportExport() && !ExasolContainer.supportsParquetImport()
  ? describe
  : describe.skip;

// [itest->dsn~runtime-csv-import-missing-target-table~1]
// [itest->dsn~runtime-csv-import-file-stream~1]
// [itest->dsn~runtime-csv-import-format-options~1]
describeImportWhenSupported("Node Import", () => {

  const randomId = new RandomUuid();
  let driver: IExasolDriver;
  let container: ExasolContainer;
  let factory: WebsocketFactory;
  jest.setTimeout(7000000);
  let schemaName = '';
  let tempDirectory = '';

  beforeAll(async () => {
    container = await startNewDockerContainer();
    const caString = await container.loadCA();
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

  async function createFile(fileName: string, fileContent: string | Uint8Array): Promise<string> {
    const path = join(tempDirectory, fileName);
    await writeFile(path, fileContent, { encoding: 'utf-8' });
    return path;
  }

  describe('importFromCsvFile', () => {
    // [itest->dsn~runtime-csv-import-cancellation~1]
    it('cancels an in-flight CSV import', async () => {
      await driver.execute(`CREATE SCHEMA ${schemaName}`);
      const tableName = `${schemaName}.TEST_TABLE`;
      await driver.execute(`CREATE TABLE ${tableName} (X VARCHAR(2000000))`);

      const controller = new AbortController();
      const importPromise = driver.importFromCsvFile(tableName, '/dev/zero', undefined, { signal: controller.signal });
      await new Promise((resolve) => setTimeout(resolve, 500));
      controller.abort();

      await expect(importPromise).rejects.toThrow("E-EDJS-20: The CSV import was aborted.");
    });

    it('fails when target table does not exist', async () => {
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

      it.each(testCases)('imports CSV file into table with $description', async ({ csvContent, csvOptions, expectedRows }) => {
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

  // [itest->dsn~runtime-parquet-import-file-stream~1]
  describeParquetImportWhenSupported('importFromParquetFile', () => {
    // [itest->dsn~runtime-parquet-import-cancellation~1]
    it('cancels an in-flight Parquet import', async () => {
      await driver.execute(`CREATE SCHEMA ${schemaName}`);
      const tableName = `${schemaName}.TEST_TABLE`;
      await driver.execute(`CREATE TABLE ${tableName} (X VARCHAR(2000000))`);

      const controller = new AbortController();
      const importPromise = driver.importFromParquetFile(tableName, '/dev/zero', undefined, { signal: controller.signal });
      await new Promise((resolve) => setTimeout(resolve, 500));
      controller.abort();

      await expect(importPromise).rejects.toThrow('E-EDJS-37: The Parquet import was aborted.');
    });

    it('imports a Parquet file into a table', async () => {
      await driver.execute(`CREATE SCHEMA ${schemaName}`);
      const tableName = `${schemaName}.TEST_TABLE`;
      await driver.execute(`CREATE TABLE ${tableName} (ID DECIMAL(18,0))`);
      const parquetFilePath = join(tempDirectory, 'test.parquet');
      await createMinimalParquetFile(parquetFilePath);

      await driver.importFromParquetFile(tableName, parquetFilePath);

      const data = await driver.query(`SELECT * FROM ${tableName}`);
      expect(data.getRows()).toStrictEqual([{ ID: 1 }, { ID: 2 }, { ID: 3 }]);
    });
  });

  // [itest->dsn~runtime-parquet-import-version-support~1]
  describeParquetImportWhenUnsupported('importFromParquetFile on an unsupported Exasol version', () => {
    it('rejects with the database message explaining that Parquet import is unavailable', async () => {
      await driver.execute(`CREATE SCHEMA ${schemaName}`);
      const tableName = `${schemaName}.TEST_TABLE`;
      await driver.execute(`CREATE TABLE ${tableName} (ID DECIMAL(18,0))`);
      const parquetFilePath = join(tempDirectory, 'test.parquet');
      await createMinimalParquetFile(parquetFilePath);

      await expect(driver.importFromParquetFile(tableName, parquetFilePath)).rejects.toThrow(/parquet.*2026\.1|2026\.1.*parquet/i);
    });
  });

  const openConnection = async (factory: WebsocketFactory, container: ExasolContainer) => {
    const driver = new ExasolDriver(factory, {
      host: container.getHost(),
      port: container.getPort(),
      user: 'sys',
      password: 'exasol'
    });
    await driver.connect();
    return driver;
  };
});

/** Creates a Parquet file with an INT32 ID column containing 1, 2, and 3. */
async function createMinimalParquetFile(filePath: string): Promise<void> {
  await promisify(execFile)(process.execPath, [join(__dirname, 'write-parquet.mjs'), filePath]);
}
