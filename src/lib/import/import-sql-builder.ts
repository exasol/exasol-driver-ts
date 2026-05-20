import { InternalAddress } from './http-transport';
import { CsvFormatOptions, TrimMode } from './types';

export function buildCsvImportSql(
  tableName: string,
  internalAddress: InternalAddress,
  fingerprint: string,
  csvOptions?: CsvFormatOptions,
): string {
  const url = `https://${internalAddress.host}:${internalAddress.port}`;

  let sql = `IMPORT INTO ${tableName} FROM CSV AT '${url}' PUBLIC KEY '${fingerprint}' FILE '001.csv'`;

  const formatClauses = buildFormatClauses(csvOptions);
  if (formatClauses.length > 0) {
    sql += ' ' + formatClauses.join(' ');
  }

  return sql;
}

function buildFormatClauses(csvOptions?: CsvFormatOptions): string[] {
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
  if (csvOptions.skip !== undefined) {
    clauses.push(`SKIP = ${csvOptions.skip}`);
  }
  if (csvOptions.trim !== undefined && csvOptions.trim !== TrimMode.NONE) {
    clauses.push(csvOptions.trim.toUpperCase());
  }
  if (csvOptions.null !== undefined) {
    clauses.push(`NULL = '${escapeSqlLiteral(csvOptions.null)}'`);
  }

  return clauses;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}
