import { serveFileRequests } from './http-protocol';
import { createTunnel } from './http-transport';
import { importParquetFile } from './parquet-file-import';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';

jest.mock('./http-transport');
jest.mock('./http-protocol');
jest.mock('./tls-transport');

const mockedCreateTunnel = createTunnel as jest.MockedFunction<typeof createTunnel>;
const mockedServeFileRequests = serveFileRequests as jest.MockedFunction<typeof serveFileRequests>;
const mockedGenerateAdHocCertificate = generateAdHocCertificate as jest.MockedFunction<typeof generateAdHocCertificate>;
const mockedWrapWithTls = wrapWithTls as jest.MockedFunction<typeof wrapWithTls>;

// [utest->dsn~runtime-parquet-import-file-readability-check~1]
describe('parquet-file-import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a missing file before opening a tunnel', async () => {
    const executeSql = jest.fn();

    await expect(importParquetFile({
      host: 'localhost', port: 8563, tableName: 'TEST_TABLE', filePath: '/missing/test.parquet', executeSql,
    })).rejects.toThrow("E-EDJS-14: Import file not found: '/missing/test.parquet'. Verify the file path exists and is readable.");

    expect(mockedCreateTunnel).not.toHaveBeenCalled();
    expect(executeSql).not.toHaveBeenCalled();
  });

  // [utest->dsn~runtime-parquet-import-file-stream~1]
  it('streams the Parquet source and cleans up tunnel resources', async () => {
    const unencryptedSocket = { destroy: jest.fn() };
    const secureSocket = { destroy: jest.fn() };
    const executeSql = jest.fn().mockResolvedValue(3);

    mockedCreateTunnel.mockResolvedValue({ socket: unencryptedSocket as never, internalAddress: { host: '127.0.0.1', port: 8563 } });
    mockedGenerateAdHocCertificate.mockReturnValue({ key: {} as never, cert: {} as never, fingerprint: 'fingerprint' });
    mockedWrapWithTls.mockReturnValue(secureSocket as never);
    mockedServeFileRequests.mockResolvedValue(3);

    await expect(importParquetFile({
      host: 'localhost', port: 8563, tableName: 'TEST_TABLE', filePath: 'README.md', executeSql,
    })).resolves.toBe(3);

    expect(executeSql).toHaveBeenCalledWith("IMPORT INTO TEST_TABLE FROM PARQUET AT 'https://127.0.0.1:8563;MaxConcurrentReads=1' PUBLIC KEY 'fingerprint' FILE '001.parquet'");
    expect(secureSocket.destroy).toHaveBeenCalled();
    expect(unencryptedSocket.destroy).toHaveBeenCalled();
  });

  // [utest->dsn~runtime-parquet-import-cancellation~1]
  it('rejects with the Parquet cancellation error while the tunnel is connecting', async () => {
    const controller = new AbortController();
    mockedCreateTunnel.mockImplementation(() => new Promise(() => undefined));

    const importPromise = importParquetFile({
      host: 'localhost', port: 8563, tableName: 'TEST_TABLE', filePath: 'README.md', executeSql: jest.fn(), options: { signal: controller.signal },
    });
    controller.abort();

    await expect(importPromise).rejects.toThrow('E-EDJS-37: The Parquet import was aborted.');
  });
});
