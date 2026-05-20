import { importCsvFile } from './csv-file-import';
import { createTunnel } from './http-transport';

jest.mock('./http-transport');

const mockedCreateTunnel = createTunnel as jest.MockedFunction<typeof createTunnel>;

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
  });
});
