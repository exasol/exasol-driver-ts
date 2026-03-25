import { importParquetFile } from './parquet-file-import';
import { createTunnel } from './http-transport';
import { readParquetMetadata } from './parquet-schema';
import * as fs from 'fs';

jest.mock('./http-transport');
jest.mock('./parquet-schema');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
  },
  constants: { R_OK: 4 },
}));

const mockedCreateTunnel = createTunnel as jest.MockedFunction<typeof createTunnel>;
const mockedReadParquetMetadata = readParquetMetadata as jest.MockedFunction<typeof readParquetMetadata>;
const mockedAccess = fs.promises.access as jest.MockedFunction<typeof fs.promises.access>;

describe('parquet-file-import', () => {
  describe('importParquetFile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should reject with file-not-found error for non-existent file', async () => {
      mockedAccess.mockRejectedValue(new Error('ENOENT'));

      await expect(
        importParquetFile('localhost', 8563, 'test_table', '/nonexistent.parquet', false, jest.fn()),
      ).rejects.toThrow('E-EDJS-14');

      expect(mockedCreateTunnel).not.toHaveBeenCalled();
    });

    it('should return 0 for empty Parquet file without establishing tunnel', async () => {
      mockedAccess.mockResolvedValue(undefined);
      mockedReadParquetMetadata.mockResolvedValue({
        metadata: { num_rows: BigInt(0), schema: [], row_groups: [], version: 2, metadata_length: 0 } as never,
        columnNames: ['id'],
      });

      const result = await importParquetFile('localhost', 8563, 'test_table', '/empty.parquet', false, jest.fn());

      expect(result).toBe(0);
      expect(mockedCreateTunnel).not.toHaveBeenCalled();
    });

    it('should reject with E-EDJS-20 for unknown column', async () => {
      mockedAccess.mockResolvedValue(undefined);
      mockedReadParquetMetadata.mockResolvedValue({
        metadata: { num_rows: BigInt(10), schema: [], row_groups: [], version: 2, metadata_length: 0 } as never,
        columnNames: ['id', 'name'],
      });

      await expect(
        importParquetFile('localhost', 8563, 'test_table', '/test.parquet', false, jest.fn(), {
          columns: ['nonexistent'],
        }),
      ).rejects.toThrow('E-EDJS-20');
    });
  });
});
