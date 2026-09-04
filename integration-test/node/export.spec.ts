import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { RandomUuid } from 'testcontainers/build/common/uuid';
import { CsvExportFormatOptions, RowSeparator } from '../../src/lib/import/types';
import { WebsocketFactory } from '../../src/lib/sql-client';
import { NodeExasolDriver as ExasolDriver } from '../../src/lib/node-sql-client';
import { IExasolDriver } from '../../src/lib/sql-client.interface';
import { ExasolContainer, startNewDockerContainer } from '../exasolContainer';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';

const describeExportWhenSupported = ExasolContainer.supportsEncryptedImportExport() ? describe : describe.skip;
const execFileAsync = promisify(execFile);

// [itest->dsn~runtime-csv-export-destination-file~1]
// [itest->dsn~runtime-csv-export-file-stream~1]
// [itest->dsn~runtime-csv-export-format-options~1]
// [itest->dsn~runtime-csv-export-compressed-file~1]
describeExportWhenSupported('Node Export', () => {
  const randomId = new RandomUuid();
  let driver: IExasolDriver;
  let container: ExasolContainer;
  let factory: WebsocketFactory;
  let schemaName = '';
  let tableName = '';
  let tempDirectory = '';
  let filePath = '';

  jest.setTimeout(7000000);

  beforeAll(async () => {
    container = await startNewDockerContainer();
    factory = createWebsocketFactoryWithCertificate(await container.loadCA());
  });

  beforeEach(async () => {
    schemaName = 'TEST_SCHEMA' + randomId.nextUuid();
    driver = await openConnection(factory, container);
    tempDirectory = await mkdtemp(join(tmpdir(), 'exasol-driver-ts-export-'));
    tableName = await createTable();
    filePath = join(tempDirectory, 'export.csv');
  });

  afterEach(async () => {
    await driver?.close();
    await rm(tempDirectory, { recursive: true, force: true });
  });

  async function createTable(): Promise<string> {
    await driver.execute(`CREATE SCHEMA ${schemaName}`);
    const tableName = `${schemaName}.TEST_TABLE`;
    await driver.execute(`CREATE TABLE ${tableName} (ID DECIMAL(18,0), NAME VARCHAR(20))`);
    await driver.execute(`INSERT INTO ${tableName} VALUES (1, 'one'), (2, 'two')`);
    return tableName;
  }

  function fileContent(): Promise<string> {
    return readFile(filePath, 'utf8');
  }

  async function decompressedFileContent(): Promise<string> {
    const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    // We use CLI tools to decompress the file to avoid adding dependencies to the project
    const commandAndArguments: Record<string, [string, string[]]> = {
      '.zip': ['unzip', ['-p', filePath]],
      '.gz': ['gzip', ['-dc', filePath]],
      '.bz2': ['bzip2', ['-dc', filePath]],
    };
    const [command, arguments_] = commandAndArguments[extension]!;
    const { stdout } = await execFileAsync(command, arguments_, { encoding: 'utf8' });
    return stdout;
  }

  // [itest->dsn~runtime-csv-export-file-stream~1]
  it('exports a table to a local CSV file', async () => {
    await expect(driver.exportToCsvFile(tableName, filePath)).resolves.toBe(2);
    await expect(fileContent()).resolves.toBe('1,one\n2,two\n');
  });

  // [itest->dsn~runtime-csv-export-file-stream~1]
  it('exports a parenthesized query to a local CSV file', async () => {
    await expect(driver.exportToCsvFile(`(SELECT NAME FROM ${tableName} ORDER BY ID)`, filePath)).resolves.toBe(2);
    await expect(fileContent()).resolves.toBe('one\ntwo\n');
  });

  // [itest->dsn~runtime-csv-export-format-options~1]
  it('applies CSV format options including column names', async () => {
    const csvOptions: CsvExportFormatOptions = {
      columnSeparator: ';', rowSeparator: RowSeparator.CRLF, encoding: 'UTF-8', withColumnNames: true,
    };

    await driver.exportToCsvFile(tableName, filePath, csvOptions);

    await expect(fileContent()).resolves.toBe('ID;NAME\r\n1;one\r\n2;two\r\n');
  });

  // [itest->dsn~runtime-csv-export-compressed-file~1]
  it.each(['.zip', '.gz', '.bz2'])('exports a compressed CSV file with the %s extension', async (extension) => {
    filePath = join(tempDirectory, `export${extension}`);

    await expect(driver.exportToCsvFile(tableName, filePath)).resolves.toBe(2);
    await expect(decompressedFileContent()).resolves.toBe('1,one\n2,two\n');
  });

  // [itest->dsn~runtime-csv-export-destination-file~1]
  it('preserves an existing destination file', async () => {
    await writeFile(filePath, 'keep me');

    await expect(driver.exportToCsvFile(tableName, filePath)).rejects.toThrow(`E-EDJS-30: CSV export destination already exists: '${filePath}'. Choose a destination path that does not exist.`);
    await expect(fileContent()).resolves.toBe('keep me');
  });

  // [itest->dsn~runtime-csv-export-cancellation~1]
  it('cancels an in-flight export and removes its partial destination', async () => {
    const controller = new AbortController();
    const exportPromise = driver.exportToCsvFile('(SELECT "$SLEEP"(5))', filePath, undefined, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 500));

    controller.abort();

    await expect(exportPromise).rejects.toMatchObject({ name: 'AbortError', message: 'E-EDJS-31: The CSV export was aborted.' });
    await expect(access(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function openConnection(factory: WebsocketFactory, container: ExasolContainer): Promise<IExasolDriver> {
  const driver = new ExasolDriver(factory, {
    host: container.getHost(), port: container.getPort(), user: 'sys', password: 'exasol', compression: true
  });
  await driver.connect();
  return driver;
}
