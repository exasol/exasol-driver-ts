import { extname } from 'node:path';
import { InternalAddress } from './http-transport';
import { CsvExportFormatOptions } from './types';

// [impl->dsn~runtime-csv-export-format-options~1]
// [impl->dsn~runtime-csv-export-compressed-file~1]
// [impl->dsn~decision-select-csv-export-compression~1]
export function buildCsvExportSql(
  source: string,
  internalAddress: InternalAddress,
  fingerprint: string,
  csvOptions?: CsvExportFormatOptions,
  filePath?: string,
): string {
  const url = `https://${internalAddress.host}:${internalAddress.port}`;
  let sql = `EXPORT ${source} INTO CSV AT '${url}' PUBLIC KEY '${fingerprint}' FILE '${getExportFileName(filePath)}'`;
  const formatClauses = buildFormatClauses(csvOptions);
  if (formatClauses.length > 0) {
    sql += ' ' + formatClauses.join(' ');
  }
  return sql;
}

function getExportFileName(filePath?: string): string {
  const extension = filePath ? extname(filePath).toLowerCase() : '';
  return ['.zip', '.gz', '.bz2'].includes(extension) ? `001${extension}` : '001.csv';
}

function buildFormatClauses(csvOptions?: CsvExportFormatOptions): string[] {
  if (!csvOptions) {
    return [];
  }

  const clauses: string[] = [];
  if (csvOptions.columnSeparator !== undefined) {
    clauses.push(`COLUMN SEPARATOR = '${escapeSqlLiteral(csvOptions.columnSeparator)}'`);
  }
  if (csvOptions.columnDelimiter !== undefined) {
    clauses.push(`COLUMN DELIMITER = '${escapeSqlLiteral(csvOptions.columnDelimiter)}'`);
  }
  if (csvOptions.rowSeparator !== undefined) {
    clauses.push(`ROW SEPARATOR = '${escapeSqlLiteral(csvOptions.rowSeparator)}'`);
  }
  if (csvOptions.encoding !== undefined) {
    clauses.push(`ENCODING = '${escapeSqlLiteral(csvOptions.encoding)}'`);
  }
  if (csvOptions.null !== undefined) {
    clauses.push(`NULL = '${escapeSqlLiteral(csvOptions.null)}'`);
  }
  if (csvOptions.withColumnNames) {
    clauses.push('WITH COLUMN NAMES');
  }
  return clauses;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}
