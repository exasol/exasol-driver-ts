import * as fs from 'node:fs';
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
type ExportParameters = Parameters<typeof exportCsvFile>[0];

// [utest->dsn~runtime-csv-export-destination-file~1]
// [utest->dsn~runtime-csv-export-file-stream~1]
describe('csv-file-export', () => {
  let tempDirectory = '';
  let destination = '';
  let executeSql: jest.Mock<Promise<number>, [string]>;
  let cancelSql: jest.Mock<Promise<void>, []>;

  beforeEach(async () => {
    jest.resetAllMocks();
    tempDirectory = await mkdtemp(join(tmpdir(), 'exasol-driver-ts-export-'));
    destination = join(tempDirectory, 'export.csv');
    executeSql = jest.fn().mockResolvedValue(2);
    cancelSql = jest.fn().mockResolvedValue(undefined);
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

  function exportFile(parameters: Partial<ExportParameters> = {}): Promise<number> {
    return exportCsvFile({
      host: 'localhost',
      port: 8563,
      source: 'MYTABLE',
      filePath: destination,
      executeSql,
      options: {},
      cancelSql,
      ...parameters,
    } as ExportParameters);
  }

  it('writes the received export data and returns the SQL row src/lib/import/csv-file-export.spec.node.tscount', async () => {
    mockedReceiveHttpRequestBody.mockImplementation(async (_socket, _request, destination) => {
      await new Promise<void>((resolve) => destination.end('ID\n1\n2\n', resolve));
    });
    await expect(exportFile()).resolves.toBe(2);

    await expect(readFile(destination, 'utf8')).resolves.toBe('ID\n1\n2\n');
  });

  // [utest->dsn~runtime-csv-export-cancellation~1]
  describe('cancellation', () => {
    it('rejects a pre-aborted export without creating its destination or opening a tunnel', async () => {
      const controller = new AbortController();
      controller.abort();
      executeSql.mockResolvedValue(2);

      await expect(exportFile({
        options: { signal: controller.signal },
      })).rejects.toMatchObject({ name: 'AbortError', message: 'E-EDJS-31: The CSV export was aborted.' });

      await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(mockedCreateTunnel).not.toHaveBeenCalled();
      expect(executeSql).not.toHaveBeenCalled();
    });

    it('rejects promptly and cleans up when the destination is created after cancellation', async () => {
      const controller = new AbortController();
      let resolveFileHandle!: (fileHandle: fs.promises.FileHandle) => void;
      const fileHandlePromise = new Promise<fs.promises.FileHandle>((resolve) => {
        resolveFileHandle = resolve;
      });
      const close = jest.fn().mockResolvedValue(undefined);
      const open = jest.spyOn(fs.promises, 'open').mockReturnValueOnce(fileHandlePromise);
      const unlink = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      const exportPromise = exportFile({ options: { signal: controller.signal } });
      controller.abort();

      await expect(exportPromise).rejects.toMatchObject({ name: 'AbortError', message: 'E-EDJS-31: The CSV export was aborted.' });
      resolveFileHandle({ close } as unknown as fs.promises.FileHandle);
      await new Promise(setImmediate);

      expect(close).toHaveBeenCalledTimes(1);
      expect(unlink).toHaveBeenCalledWith(destination);
      open.mockRestore();
      unlink.mockRestore();
    });

    it('cancels an in-flight export, destroys tunnel resources, and removes the partial destination', async () => {
      const controller = new AbortController();
      const unencryptedSocket = { destroy: jest.fn() };
      const secureSocket = { destroy: jest.fn(), write: jest.fn() };
      let notifyQueryStarted!: () => void;
      const queryStarted = new Promise<void>((resolve) => {
        notifyQueryStarted = resolve;
      });
      executeSql.mockImplementation(() => {
        notifyQueryStarted();
        return new Promise<number>(() => undefined);
      });
      mockedCreateTunnel.mockResolvedValue({
        socket: unencryptedSocket as never,
        internalAddress: { host: '127.0.0.1', port: 8563 },
      });
      mockedWrapWithTls.mockReturnValue(secureSocket as never);
      mockedReadHttpRequest.mockImplementation(() => new Promise(() => undefined));

      const exportPromise = exportFile({
        options: { signal: controller.signal },
      });
      await queryStarted;

      controller.abort();

      await expect(exportPromise).rejects.toMatchObject({ name: 'AbortError', message: 'E-EDJS-31: The CSV export was aborted.' });
      expect(cancelSql).toHaveBeenCalledTimes(1);
      expect(secureSocket.destroy).toHaveBeenCalled();
      expect(unencryptedSocket.destroy).toHaveBeenCalled();
      await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('does not cancel SQL after the export query has completed', async () => {
      const controller = new AbortController();
      let notifyTransferStarted!: () => void;
      const transferStarted = new Promise<void>((resolve) => {
        notifyTransferStarted = resolve;
      });
      executeSql.mockResolvedValue(2);
      mockedReadHttpRequest.mockImplementation(async () => {
        notifyTransferStarted();
        return new Promise(() => undefined);
      });

      const exportPromise = exportFile({ options: { signal: controller.signal } });
      await transferStarted;
      await Promise.resolve();

      controller.abort();

      await expect(exportPromise).rejects.toMatchObject({ name: 'AbortError', message: 'E-EDJS-31: The CSV export was aborted.' });
      expect(cancelSql).not.toHaveBeenCalled();
    });
  });

  it('rejects an existing destination before opening the tunnel', async () => {
    await writeFile(destination, 'keep me');

    await expect(exportFile())
      .rejects.toThrow(`E-EDJS-30: CSV export destination already exists: '${destination}'. Choose a destination path that does not exist.`);

    await expect(readFile(destination, 'utf8')).resolves.toBe('keep me');
    expect(mockedCreateTunnel).not.toHaveBeenCalled();
    expect(executeSql).not.toHaveBeenCalled();
  });

  it('removes the newly-created destination after a transfer failure', async () => {
    mockedReceiveHttpRequestBody.mockRejectedValue(new Error('disk full'));
    await expect(exportFile()).rejects.toThrow('disk full');

    await expect(readFile(destination, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('removes the newly-created destination after a SQL failure', async () => {
    mockedReceiveHttpRequestBody.mockImplementation(async () => new Promise<void>(() => undefined));
    executeSql.mockRejectedValue(new Error('SQL failed'));

    await expect(exportFile()).rejects.toThrow('SQL failed');

    await expect(readFile(destination, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports both export and cleanup failures when removing a partial export fails', async () => {
    const exportError = new Error('transfer failed');
    const cleanupError = new Error('cleanup failed');
    const unlink = jest.spyOn(fs.promises, 'unlink').mockRejectedValue(cleanupError);
    mockedReceiveHttpRequestBody.mockRejectedValue(exportError);
    await expect(exportFile()).rejects.toMatchObject({
      message: 'CSV export failed and the partial destination file could not be removed.',
      cause: exportError,
      errors: [exportError, cleanupError],
    });

    expect(unlink).toHaveBeenCalledWith(destination);
    await expect(readFile(destination)).resolves.toEqual(Buffer.alloc(0));
  });
});
