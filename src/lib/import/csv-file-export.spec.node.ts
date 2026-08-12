import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportCsvFile } from './csv-file-export';
import { readHttpRequest, receiveHttpRequestBody } from './http-protocol';
import { createTunnel } from './http-transport';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';

jest.mock('./http-transport');
jest.mock('./http-protocol');
jest.mock('./tls-transport');

const mockedCreateTunnel = createTunnel as jest.MockedFunction<typeof createTunnel>;
const mockedReadHttpRequest = readHttpRequest as jest.MockedFunction<typeof readHttpRequest>;
const mockedReceiveHttpRequestBody = receiveHttpRequestBody as jest.MockedFunction<typeof receiveHttpRequestBody>;
const mockedGenerateAdHocCertificate = generateAdHocCertificate as jest.MockedFunction<typeof generateAdHocCertificate>;
const mockedWrapWithTls = wrapWithTls as jest.MockedFunction<typeof wrapWithTls>;

// [utest->dsn~runtime-csv-export-destination-file~1]
// [utest->dsn~runtime-csv-export-file-stream~1]
describe('csv-file-export', () => {
  let tempDirectory = '';

  beforeEach(async () => {
    jest.resetAllMocks();
    tempDirectory = await mkdtemp(join(tmpdir(), 'exasol-driver-ts-export-'));
    mockedCreateTunnel.mockResolvedValue({
      socket: { destroy: jest.fn() } as never,
      internalAddress: { host: '127.0.0.1', port: 8563 },
    });
    mockedGenerateAdHocCertificate.mockReturnValue({ key: {} as never, cert: {} as never, fingerprint: 'fingerprint' });
    mockedWrapWithTls.mockReturnValue({
      destroy: jest.fn(),
      write: jest.fn((_data: string, callback: (error?: Error | null) => void) => callback(null)),
    } as never);
    mockedReadHttpRequest.mockResolvedValue({ headers: 'PUT /001.csv HTTP/1.1\r\nContent-Length: 7\r\n\r\n', initialBody: Buffer.alloc(0) });
  });

  afterEach(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('writes the received export data and returns the SQL row count', async () => {
    mockedReceiveHttpRequestBody.mockImplementation(async (_socket, _request, destination) => {
      await new Promise<void>((resolve) => destination.end('ID\n1\n2\n', resolve));
    });
    const destination = join(tempDirectory, 'export.csv');

    await expect(exportCsvFile({
      host: 'localhost', port: 8563, source: 'MYTABLE', filePath: destination,
      executeSql: jest.fn().mockResolvedValue(2),
    })).resolves.toBe(2);

    await expect(readFile(destination, 'utf8')).resolves.toBe('ID\n1\n2\n');
  });

  it('rejects an existing destination before opening the tunnel', async () => {
    const destination = join(tempDirectory, 'export.csv');
    await writeFile(destination, 'keep me');
    const executeSql = jest.fn();

    await expect(exportCsvFile({ host: 'localhost', port: 8563, source: 'MYTABLE', filePath: destination, executeSql }))
      .rejects.toThrow(`E-EDJS-30: CSV export destination already exists: '${destination}'. Choose a destination path that does not exist.`);

    await expect(readFile(destination, 'utf8')).resolves.toBe('keep me');
    expect(mockedCreateTunnel).not.toHaveBeenCalled();
    expect(executeSql).not.toHaveBeenCalled();
  });

  it('removes the newly-created destination after a transfer failure', async () => {
    mockedReceiveHttpRequestBody.mockRejectedValue(new Error('disk full'));
    const destination = join(tempDirectory, 'export.csv');

    await expect(exportCsvFile({
      host: 'localhost', port: 8563, source: 'MYTABLE', filePath: destination,
      executeSql: jest.fn().mockResolvedValue(2),
    })).rejects.toThrow('disk full');

    await expect(readFile(destination, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('removes the newly-created destination after a SQL failure', async () => {
    mockedReceiveHttpRequestBody.mockImplementation(async () => new Promise<void>(() => undefined));
    const destination = join(tempDirectory, 'export.csv');

    await expect(exportCsvFile({
      host: 'localhost', port: 8563, source: 'MYTABLE', filePath: destination,
      executeSql: jest.fn().mockRejectedValue(new Error('SQL failed')),
    })).rejects.toThrow('SQL failed');

    await expect(readFile(destination, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
