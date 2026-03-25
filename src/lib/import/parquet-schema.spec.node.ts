import { inferParquetSchema } from './parquet-schema';
import { parquetMetadata, parquetSchema } from 'hyparquet';
import * as fs from 'fs';

jest.mock('hyparquet');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(),
    access: jest.fn(),
  },
}));

const mockedParquetMetadata = parquetMetadata as jest.MockedFunction<typeof parquetMetadata>;
const mockedParquetSchema = parquetSchema as jest.MockedFunction<typeof parquetSchema>;
const mockedReadFile = fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>;

describe('parquet-schema', () => {
  describe('inferParquetSchema', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should map BOOLEAN type correctly', async () => {
      setupMocks([{ name: 'flag', type: 'BOOLEAN' }], 10);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns).toEqual([{ name: 'flag', exasolType: 'BOOLEAN' }]);
      expect(schema.rowCount).toBe(10);
    });

    it('should map INT32 to DECIMAL(18,0)', async () => {
      setupMocks([{ name: 'id', type: 'INT32' }], 5);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('DECIMAL(18,0)');
    });

    it('should map INT64 to DECIMAL(36,0)', async () => {
      setupMocks([{ name: 'big_id', type: 'INT64' }], 5);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('DECIMAL(36,0)');
    });

    it('should map FLOAT and DOUBLE to DOUBLE', async () => {
      setupMocks(
        [
          { name: 'f', type: 'FLOAT' },
          { name: 'd', type: 'DOUBLE' },
        ],
        1,
      );

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('DOUBLE');
      expect(schema.columns[1].exasolType).toBe('DOUBLE');
    });

    it('should map STRING logical type to VARCHAR(2000000)', async () => {
      setupMocks([{ name: 'text', type: 'BYTE_ARRAY', logical_type: { type: 'STRING' } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('VARCHAR(2000000)');
    });

    it('should map DATE logical type to DATE', async () => {
      setupMocks([{ name: 'dt', type: 'INT32', logical_type: { type: 'DATE' } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('DATE');
    });

    it('should map TIMESTAMP without UTC to TIMESTAMP', async () => {
      setupMocks([{ name: 'ts', type: 'INT64', logical_type: { type: 'TIMESTAMP', isAdjustedToUTC: false, unit: 'MILLIS' } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('TIMESTAMP');
    });

    it('should map TIMESTAMP with UTC to TIMESTAMP WITH LOCAL TIME ZONE', async () => {
      setupMocks([{ name: 'ts', type: 'INT64', logical_type: { type: 'TIMESTAMP', isAdjustedToUTC: true, unit: 'MILLIS' } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('TIMESTAMP WITH LOCAL TIME ZONE');
    });

    it('should map DECIMAL logical type with precision and scale', async () => {
      setupMocks([{ name: 'amount', type: 'FIXED_LEN_BYTE_ARRAY', logical_type: { type: 'DECIMAL', precision: 10, scale: 2 } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('DECIMAL(10,2)');
    });

    it('should cap DECIMAL precision at 36', async () => {
      setupMocks([{ name: 'big', type: 'FIXED_LEN_BYTE_ARRAY', logical_type: { type: 'DECIMAL', precision: 76, scale: 0 } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('DECIMAL(36,0)');
    });

    it('should map INT96 to TIMESTAMP', async () => {
      setupMocks([{ name: 'ts', type: 'INT96' }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('TIMESTAMP');
    });

    it('should map INTEGER logical type with bitWidth <= 32 to DECIMAL(18,0)', async () => {
      setupMocks([{ name: 'small', type: 'INT32', logical_type: { type: 'INTEGER', bitWidth: 16, isSigned: true } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('DECIMAL(18,0)');
    });

    it('should map INTEGER logical type with bitWidth > 32 to DECIMAL(36,0)', async () => {
      setupMocks([{ name: 'big', type: 'INT64', logical_type: { type: 'INTEGER', bitWidth: 64, isSigned: false } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('DECIMAL(36,0)');
    });

    it('should map legacy UTF8 converted_type to VARCHAR(2000000)', async () => {
      setupMocks([{ name: 'text', type: 'BYTE_ARRAY', converted_type: 'UTF8' }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('VARCHAR(2000000)');
    });

    it('should generate DDL with toDDL', async () => {
      setupMocks(
        [
          { name: 'id', type: 'INT32' },
          { name: 'name', type: 'BYTE_ARRAY', logical_type: { type: 'STRING' } },
        ],
        100,
      );

      const schema = await inferParquetSchema('/test.parquet');
      const ddl = schema.toDDL('my_table', 'my_schema');

      expect(ddl).toBe('CREATE TABLE my_schema.my_table (id DECIMAL(18,0), name VARCHAR(2000000))');
    });

    it('should generate DDL without schema prefix', async () => {
      setupMocks([{ name: 'val', type: 'DOUBLE' }], 1);

      const schema = await inferParquetSchema('/test.parquet');
      const ddl = schema.toDDL('tbl');

      expect(ddl).toBe('CREATE TABLE tbl (val DOUBLE)');
    });

    it('should reject with E-EDJS-17 for non-existent file', async () => {
      mockedReadFile.mockRejectedValue(new Error('ENOENT'));

      await expect(inferParquetSchema('/nonexistent.parquet')).rejects.toThrow('E-EDJS-17');
    });

    it('should reject with E-EDJS-17 for invalid Parquet file', async () => {
      const buf = Buffer.from('not a parquet file');
      mockedReadFile.mockResolvedValue(buf);
      mockedParquetMetadata.mockImplementation(() => {
        throw new Error('Invalid Parquet');
      });

      await expect(inferParquetSchema('/bad.parquet')).rejects.toThrow('E-EDJS-17');
    });

    it('should fall back to VARCHAR(2000000) for unsupported types', async () => {
      setupMocks([{ name: 'nested', type: 'BYTE_ARRAY', logical_type: { type: 'LIST' } }], 1);

      const schema = await inferParquetSchema('/test.parquet');

      expect(schema.columns[0].exasolType).toBe('VARCHAR(2000000)');
    });
  });
});

function setupMocks(elements: Array<Record<string, unknown>>, numRows: number) {
  const buf = Buffer.from('PAR1fake');
  mockedReadFile.mockResolvedValue(buf);

  const metadata = {
    version: 2,
    schema: [{ name: 'schema' }, ...elements.map((e) => ({ ...e, repetition_type: 'OPTIONAL' }))],
    num_rows: BigInt(numRows),
    row_groups: [],
  };
  mockedParquetMetadata.mockReturnValue(metadata as never);

  const tree = {
    element: { name: 'schema' },
    children: elements.map((e) => ({
      element: e,
      children: [],
      count: 0,
      path: [e['name'] as string],
    })),
    count: elements.length,
    path: [],
  };
  mockedParquetSchema.mockReturnValue(tree as never);
}
