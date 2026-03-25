import { CsvFormatOptions } from './types';

const DEFAULT_SEPARATOR = ',';
const DEFAULT_DELIMITER = '"';
const DEFAULT_ROW_SEPARATOR = '\n';
const DEFAULT_NULL = '';

/**
 * Serializes an array of row objects to CSV format as a string.
 * Handles quoting, escaping, and NULL values.
 */
export function serializeRowsToCsv(
  rows: Record<string, unknown>[],
  columnNames: string[],
  csvOptions?: CsvFormatOptions,
): string {
  if (rows.length === 0) return '';

  const separator = csvOptions?.columnSeparator ?? DEFAULT_SEPARATOR;
  const delimiter = csvOptions?.columnDelimiter ?? DEFAULT_DELIMITER;
  const rowSeparator = csvOptions?.rowSeparator === 'CRLF' ? '\r\n' : (csvOptions?.rowSeparator ?? DEFAULT_ROW_SEPARATOR);
  const nullValue = csvOptions?.null ?? DEFAULT_NULL;

  const lines: string[] = [];

  for (const row of rows) {
    const fields: string[] = [];
    for (const col of columnNames) {
      const value = row[col];
      if (value === null || value === undefined) {
        fields.push(nullValue);
      } else {
        fields.push(formatCsvField(String(value), separator, delimiter));
      }
    }
    lines.push(fields.join(separator));
  }

  return lines.join(rowSeparator) + rowSeparator;
}

function formatCsvField(value: string, separator: string, delimiter: string): string {
  const needsQuoting = value.indexOf(separator) !== -1 || value.indexOf(delimiter) !== -1 || value.indexOf('\n') !== -1 || value.indexOf('\r') !== -1;

  if (!needsQuoting) {
    return value;
  }

  const escaped = value.replace(new RegExp(escapeRegExp(delimiter), 'g'), delimiter + delimiter);
  return delimiter + escaped + delimiter;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
