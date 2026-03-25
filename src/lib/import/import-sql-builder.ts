import { CsvFormatOptions, InternalAddress, ParquetColumnInfo, ColumnNameMode } from './types';

export function buildCsvImportSql(
  tableName: string,
  internalAddress: InternalAddress,
  encrypted: boolean,
  fingerprint?: string,
  csvOptions?: CsvFormatOptions,
): string {
  const protocol = encrypted ? 'https' : 'http';
  const url = `${protocol}://${internalAddress.host}:${internalAddress.port}`;

  let sql = `IMPORT INTO ${tableName} FROM CSV AT '${url}'`;

  if (encrypted && fingerprint) {
    sql += ` PUBLIC KEY '${fingerprint}'`;
  }

  sql += ` FILE '001.csv'`;

  const formatClauses = buildFormatClauses(csvOptions);
  if (formatClauses.length > 0) {
    sql += ' ' + formatClauses.join(' ');
  }

  return sql;
}

export function buildCreateTableSql(
  tableName: string,
  columns: ParquetColumnInfo[],
  columnNameMode: ColumnNameMode = 'quoted',
): string {
  const columnDefs = columns.map((col) => {
    const name = formatColumnName(col.name, columnNameMode);
    return `${name} ${col.exasolType}`;
  });

  return `CREATE TABLE ${tableName} (${columnDefs.join(', ')})`;
}

function formatColumnName(name: string, mode: ColumnNameMode): string {
  if (mode === 'sanitized') {
    return sanitizeIdentifier(name);
  }
  const escaped = name.replace(/"/g, '""');
  return `"${escaped}"`;
}

function sanitizeIdentifier(name: string): string {
  if (name.length === 0) {
    return '"_"';
  }
  let sanitized = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }
  return sanitized;
}

function buildFormatClauses(csvOptions?: CsvFormatOptions): string[] {
  if (!csvOptions) {
    return [];
  }

  const clauses: string[] = [];

  if (csvOptions.columnSeparator !== undefined) {
    clauses.push(`COLUMN SEPARATOR = '${csvOptions.columnSeparator}'`);
  }
  if (csvOptions.columnDelimiter !== undefined) {
    clauses.push(`COLUMN DELIMITER = '${csvOptions.columnDelimiter}'`);
  }
  if (csvOptions.rowSeparator !== undefined) {
    clauses.push(`ROW SEPARATOR = '${csvOptions.rowSeparator}'`);
  }
  if (csvOptions.encoding !== undefined) {
    clauses.push(`ENCODING = '${csvOptions.encoding}'`);
  }
  if (csvOptions.skip !== undefined) {
    clauses.push(`SKIP = ${csvOptions.skip}`);
  }
  if (csvOptions.trim !== undefined) {
    clauses.push(`TRIM = '${csvOptions.trim}'`);
  }
  if (csvOptions.null !== undefined) {
    clauses.push(`NULL = '${csvOptions.null}'`);
  }

  return clauses;
}
