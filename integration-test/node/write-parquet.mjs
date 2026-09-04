// hyparquet-writer is ESM-only, while Jest currently transpiles these TypeScript
// integration tests to CommonJS. Use this separate ESM process until Jest is migrated:
// https://github.com/exasol/exasol-driver-ts/issues/102
import { parquetWriteFile } from 'hyparquet-writer';

const filename = process.argv[2];

if (!filename) {
  throw new Error('Expected the destination Parquet file path as the first argument.');
}

parquetWriteFile({
  filename,
  columnData: [{ name: 'ID', data: [1, 2, 3], type: 'INT32' }],
});
