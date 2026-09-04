import { ExaErrorBuilder } from '../errors/error-reporting';
import { buildParquetImportSql } from './import-sql-builder';
import { importLocalFile } from './local-file-import';
import { FileImportOptions, ParquetImportOptions } from './types';

interface ImportParquetFileParameters {
  host: string;
  port: number;
  tableName: string;
  filePath: string;
  // Reserved for future Parquet format options; local-file serving does not consume it yet.
  parquetOptions?: ParquetImportOptions;
  executeSql: (sql: string) => Promise<number>;
  options?: FileImportOptions;
  cancelSql?: () => Promise<void>;
}

// `parquetOptions` is spread into `importLocalFile()` below, which has no `parquetOptions`
// field and never reads it. That is harmless today because `ParquetImportOptions` is
// `Record<string, never>`, so no caller can construct a non-empty value for it.
//
// This assignment is a compile-time tripwire, not a runtime check: it exists purely so that
// the day `ParquetImportOptions` gains a real field, this line stops compiling. When that
// happens, wire the option through `importLocalFile`/`buildParquetImportSql` (or wherever it
// needs to land) and delete this line — do not just widen its type to make it compile again.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parquetOptionsMustStayEmptyUntilWired: Record<string, never> = {} as ParquetImportOptions;

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
