import * as fs from 'node:fs';
import { PassThrough } from 'node:stream';
import { importCsvFile } from './csv-file-import';
import { readHttpRequest, sendChunkedResponse } from './http-protocol';
import { createTunnel } from './http-transport';
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

// [utest->dsn~runtime-csv-import-file-readability-check~1]
describe('csv-file-import', () => {
  describe('importCsvFile', () => {
    it('should reject with file-not-found error for non-existent file', async () => {
      const mockExecuteSql = jest.fn();

      await expect(importCsvFile('localhost', 8563, 'test_table', '/nonexistent/path/test.csv', mockExecuteSql)).rejects.toThrow(
        "E-EDJS-14: Import file not found: '/nonexistent/path/test.csv'. Verify the file path exists and is readable.",
      );

      expect(mockedCreateTunnel).not.toHaveBeenCalled();
      expect(mockExecuteSql).not.toHaveBeenCalled();
    });

    it('should not establish tunnel when file does not exist', async () => {
      const mockExecuteSql = jest.fn();

      try {
        await importCsvFile('localhost', 8563, 'test_table', '/another/missing/file.csv', mockExecuteSql);
      } catch {
        // expected
      }

      expect(mockedCreateTunnel).not.toHaveBeenCalled();
    });

    it('should fail when socket connection fails', async () => {
      const mockExecuteSql = jest.fn();

      mockedCreateTunnel.mockRejectedValue(new Error('mocked error'));
      await expect(importCsvFile('localhost', 8563, 'test_table', 'README.md', mockExecuteSql)).rejects.toThrow("mocked error");

      expect(mockExecuteSql).not.toHaveBeenCalled();
    });

    // [utest->dsn~runtime-csv-import-cancellation~1]
    it('should cancel the query and release tunnel and file resources when the signal aborts', async () => {
      const controller = new AbortController();
      const unencryptedSocket = { destroy: jest.fn() };
      const secureSocket = { destroy: jest.fn() };
      const fileStream = new PassThrough();
      const destroyFileStream = jest.spyOn(fileStream, 'destroy');
      let notifyQueryStarted!: () => void;
      const queryStarted = new Promise<void>((resolve) => {
        notifyQueryStarted = resolve;
      });
      const mockExecuteSql = jest.fn(() => {
        notifyQueryStarted();
        return new Promise<number>(() => undefined);
      });
      const mockCancelSql = jest.fn().mockResolvedValue(undefined);

      mockedCreateTunnel.mockResolvedValue({
        socket: unencryptedSocket as never,
        internalAddress: { host: '127.0.0.1', port: 8563 },
      });
      mockedGenerateAdHocCertificate.mockReturnValue({ key: {} as never, cert: {} as never, fingerprint: 'fingerprint' });
      mockedWrapWithTls.mockReturnValue(secureSocket as never);
      mockedReadHttpRequest.mockResolvedValue('GET /001.csv HTTP/1.1\r\n\r\n');
      mockedSendChunkedResponse.mockImplementation(() => new Promise<void>(() => undefined));
      mockedCreateReadStream.mockReturnValue(fileStream as never);

      const importPromise = importCsvFile(
        'localhost',
        8563,
        'test_table',
        'README.md',
        mockExecuteSql,
        undefined,
        { signal: controller.signal },
        mockCancelSql,
      );
      await queryStarted;

      controller.abort();

      await expect(importPromise).rejects.toThrow("E-EDJS-20: The CSV import was aborted.");
      expect(mockCancelSql).toHaveBeenCalledTimes(1);
      expect(destroyFileStream).toHaveBeenCalled();
      expect(secureSocket.destroy).toHaveBeenCalled();
      expect(unencryptedSocket.destroy).toHaveBeenCalled();
    });
  });
});
