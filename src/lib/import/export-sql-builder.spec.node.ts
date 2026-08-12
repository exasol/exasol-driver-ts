import { buildCsvExportSql } from './export-sql-builder';
import { RowSeparator } from './types';

// [utest->dsn~runtime-csv-export-format-options~1]
describe('export-sql-builder', () => {
  it('builds EXPORT SQL for a table', () => {
    expect(buildCsvExportSql('MYSCHEMA.MYTABLE', { host: '192.168.1.10', port: 4362 }, 'fingerprint')).toBe(
      "EXPORT MYSCHEMA.MYTABLE INTO CSV AT 'https://192.168.1.10:4362' PUBLIC KEY 'fingerprint' FILE '001.csv'",
    );
  });

  it('passes a parenthesized query through as the export source', () => {
    expect(buildCsvExportSql('(SELECT ID, NAME FROM MYTABLE)', { host: 'localhost', port: 8563 }, 'fingerprint')).toBe(
      "EXPORT (SELECT ID, NAME FROM MYTABLE) INTO CSV AT 'https://localhost:8563' PUBLIC KEY 'fingerprint' FILE '001.csv'",
    );
  });

  it('adds all supported CSV export options and escapes literals', () => {
    expect(buildCsvExportSql('MYTABLE', { host: 'localhost', port: 8563 }, 'fingerprint', {
      columnSeparator: ';',
      columnDelimiter: "'",
      rowSeparator: RowSeparator.CRLF,
      encoding: 'ASCII',
      null: "N'ULL",
      withColumnNames: true,
    })).toBe(
      "EXPORT MYTABLE INTO CSV AT 'https://localhost:8563' PUBLIC KEY 'fingerprint' FILE '001.csv' COLUMN SEPARATOR = ';' COLUMN DELIMITER = '''' ROW SEPARATOR = 'CRLF' ENCODING = 'ASCII' NULL = 'N''ULL' WITH COLUMN NAMES",
    );
  });

  it('does not allow NONE as a CSV export row separator', () => {
    // @ts-expect-error NONE is only valid for FBV files.
    const rowSeparator: import('./types').CsvExportRowSeparator = RowSeparator.NONE;

    expect(rowSeparator).toBe(RowSeparator.NONE);
  });
});
