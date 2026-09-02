import { ExaErrorBuilder } from '../errors/error-reporting';
import { buildParquetImportSql } from './import-sql-builder';
import { importLocalFile } from './local-file-import';
import { FileImportOptions } from './types';

interface ImportParquetFileParameters {
  host: string;
  port: number;
  tableName: string;
  filePath: string;
  executeSql: (sql: string) => Promise<number>;
  options?: FileImportOptions;
  cancelSql?: () => Promise<void>;
}

// [impl->dsn~runtime-parquet-import-file-readability-check~1]
// [impl->dsn~runtime-parquet-import-file-stream~1]
// [impl->dsn~runtime-parquet-import-cancellation~1]
export async function importParquetFile({ tableName, ...parameters }: ImportParquetFileParameters): Promise<number> {
  return importLocalFile({
    ...parameters,
    buildImportSql: (internalAddress, fingerprint) => buildParquetImportSql(tableName, internalAddress, fingerprint),
    newAbortedError: newParquetImportAbortedError,
    fileServingOptions: { rangeRequests: true },
  });
}

function newParquetImportAbortedError(): DOMException {
  const message = new ExaErrorBuilder('E-EDJS-37').message('The Parquet import was aborted.').toString();
  return new DOMException(message, 'AbortError');
}
