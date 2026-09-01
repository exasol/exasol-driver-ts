import { ExaErrorBuilder } from '../errors/error-reporting';
import { buildCsvImportSql } from './import-sql-builder';
import { importLocalFile } from './local-file-import';
import { CsvFormatOptions, CsvImportOptions } from './types';

interface ImportCsvFileParameters {
  host: string;
  port: number;
  tableName: string;
  filePath: string;
  executeSql: (sql: string) => Promise<number>;
  csvOptions?: CsvFormatOptions;
  options?: CsvImportOptions;
  cancelSql?: () => Promise<void>;
}

// [impl->dsn~decision-stream-csv-through-import-tunnel~1]
export async function importCsvFile({ tableName, csvOptions, ...parameters }: ImportCsvFileParameters): Promise<number> {
  // [impl->dsn~runtime-csv-import-file-readability-check~1]
  // [impl->dsn~runtime-csv-import-missing-target-table~1]
  // [impl->dsn~runtime-csv-import-file-stream~1]
  // [impl->dsn~runtime-csv-import-cancellation~1]
  return importLocalFile({
    ...parameters,
    buildImportSql: (internalAddress, fingerprint) => buildCsvImportSql(tableName, internalAddress, fingerprint, csvOptions),
    newAbortedError: newCsvImportAbortedError,
  });
}

function newCsvImportAbortedError(): DOMException {
  const message = new ExaErrorBuilder('E-EDJS-20').message('The CSV import was aborted.').toString();
  return new DOMException(message, 'AbortError');
}
