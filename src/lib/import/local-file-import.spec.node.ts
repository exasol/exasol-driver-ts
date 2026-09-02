import { serveFileRequests } from './http-protocol';
import { createTunnel } from './http-transport';
import { importLocalFile } from './local-file-import';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';

jest.mock('./http-transport');
jest.mock('./http-protocol');
jest.mock('./tls-transport');

const mockedCreateTunnel = createTunnel as jest.MockedFunction<typeof createTunnel>;
const mockedServeFileRequests = serveFileRequests as jest.MockedFunction<typeof serveFileRequests>;
const mockedGenerateAdHocCertificate = generateAdHocCertificate as jest.MockedFunction<typeof generateAdHocCertificate>;
const mockedWrapWithTls = wrapWithTls as jest.MockedFunction<typeof wrapWithTls>;

// [utest->dsn~runtime-csv-import-file-stream~1]
describe('local-file-import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds the format-specific SQL and streams the local file through the tunnel', async () => {
    const unencryptedSocket = { destroy: jest.fn() };
    const secureSocket = { destroy: jest.fn() };
    const buildImportSql = jest.fn().mockReturnValue('IMPORT SQL');
    const executeSql = jest.fn().mockResolvedValue(3);

    mockedCreateTunnel.mockResolvedValue({
      socket: unencryptedSocket as never,
      internalAddress: { host: '127.0.0.1', port: 8563 },
    });
    mockedGenerateAdHocCertificate.mockReturnValue({ key: {} as never, cert: {} as never, fingerprint: 'fingerprint' });
    mockedWrapWithTls.mockReturnValue(secureSocket as never);
    mockedServeFileRequests.mockResolvedValue(3);

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
    expect(mockedServeFileRequests).toHaveBeenCalledWith(secureSocket, expect.any(String), executeSql.mock.results[0]?.value, expect.any(Object));
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
