import { importCsvFile } from './csv-file-import';
import { createTunnel } from './http-transport';

jest.mock('./http-transport');

const mockedCreateTunnel = createTunnel as jest.MockedFunction<typeof createTunnel>;

describe('csv-file-import', () => {
  describe('importCsvFile', () => {
    it('should reject with file-not-found error for non-existent file', async () => {
      const mockExecuteSql = jest.fn();

      await expect(importCsvFile('localhost', 8563, 'test_table', '/nonexistent/path/test.csv', false, mockExecuteSql)).rejects.toThrow(
        'E-EDJS-14',
      );

      expect(mockedCreateTunnel).not.toHaveBeenCalled();
      expect(mockExecuteSql).not.toHaveBeenCalled();
    });

    it('should not establish tunnel when file does not exist', async () => {
      const mockExecuteSql = jest.fn();

      try {
        await importCsvFile('localhost', 8563, 'test_table', '/another/missing/file.csv', false, mockExecuteSql);
      } catch {
        // expected
      }

      expect(mockedCreateTunnel).not.toHaveBeenCalled();
    });
  });
});
