import * as fs from 'node:fs';
import { PassThrough } from 'node:stream';
import { readHttpRequest, sendChunkedResponse } from './http-protocol';
import { createTunnel } from './http-transport';
import { importLocalFile } from './local-file-import';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';

jest.mock('node:fs', () => ({ ...jest.requireActual('node:fs'), createReadStream: jest.fn() }));
jest.mock('./http-transport');
jest.mock('./http-protocol');
jest.mock('./tls-transport');

const mockedCreateTunnel = createTunnel as jest.MockedFunction<typeof createTunnel>;
const mockedReadHttpRequest = readHttpRequest as jest.MockedFunction<typeof readHttpRequest>;
const mockedSendChunkedResponse = sendChunkedResponse as jest.MockedFunction<typeof sendChunkedResponse>;
const mockedGenerateAdHocCertificate = generateAdHocCertificate as jest.MockedFunction<typeof generateAdHocCertificate>;
const mockedWrapWithTls = wrapWithTls as jest.MockedFunction<typeof wrapWithTls>;
const mockedCreateReadStream = fs.createReadStream as jest.MockedFunction<typeof fs.createReadStream>;

// [utest->dsn~runtime-csv-import-file-stream~1]
describe('local-file-import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds the format-specific SQL and streams the local file through the tunnel', async () => {
    const unencryptedSocket = { destroy: jest.fn() };
    const secureSocket = { destroy: jest.fn() };
    const fileStream = new PassThrough();
    const buildImportSql = jest.fn().mockReturnValue('IMPORT SQL');
    const executeSql = jest.fn().mockResolvedValue(3);

    mockedCreateTunnel.mockResolvedValue({
      socket: unencryptedSocket as never,
      internalAddress: { host: '127.0.0.1', port: 8563 },
    });
    mockedGenerateAdHocCertificate.mockReturnValue({ key: {} as never, cert: {} as never, fingerprint: 'fingerprint' });
    mockedWrapWithTls.mockReturnValue(secureSocket as never);
    mockedReadHttpRequest.mockResolvedValue({ headers: 'GET /001 HTTP/1.1\r\n\r\n', initialBody: Buffer.alloc(0) });
    mockedCreateReadStream.mockReturnValue(fileStream as never);
    mockedSendChunkedResponse.mockResolvedValue(undefined);

    await expect(importLocalFile({
      host: 'localhost',
      port: 8563,
      filePath: 'README.md',
      executeSql,
      buildImportSql,
      newAbortedError: () => new DOMException('aborted', 'AbortError'),
    })).resolves.toBe(3);

    expect(buildImportSql).toHaveBeenCalledWith({ host: '127.0.0.1', port: 8563 }, 'fingerprint');
    expect(executeSql).toHaveBeenCalledWith('IMPORT SQL');
    expect(mockedSendChunkedResponse).toHaveBeenCalledWith(secureSocket, fileStream);
    expect(secureSocket.destroy).toHaveBeenCalled();
    expect(unencryptedSocket.destroy).toHaveBeenCalled();
  });

  // [utest->dsn~runtime-csv-import-cancellation~1]
  it('rejects before opening a tunnel when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(importLocalFile({
      host: 'localhost',
      port: 8563,
      filePath: 'README.md',
      executeSql: jest.fn(),
      buildImportSql: jest.fn(),
      options: { signal: controller.signal },
      newAbortedError: () => new DOMException('aborted', 'AbortError'),
    })).rejects.toThrow('aborted');

    expect(mockedCreateTunnel).not.toHaveBeenCalled();
  });
});
