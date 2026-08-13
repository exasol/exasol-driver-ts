import { buildCsvExportSql } from './export-sql-builder';
import { RowSeparator } from './types';

// [utest->dsn~runtime-csv-export-format-options~1]
// [utest->dsn~runtime-csv-export-compressed-file~1]
describe('export-sql-builder', () => {
  it('builds EXPORT SQL for a table', () => {
    expect(buildCsvExportSql('MYSCHEMA.MYTABLE', { host: '192.168.1.10', port: 4362 }, 'fingerprint')).toBe(
      "EXPORT MYSCHEMA.MYTABLE INTO CSV AT 'https://192.168.1.10:4362' PUBLIC KEY 'fingerprint' FILE '001.csv' REPLACE",
    );
  });

  it('passes a parenthesized query through as the export source', () => {
    expect(buildCsvExportSql('(SELECT ID, NAME FROM MYTABLE)', { host: 'localhost', port: 8563 }, 'fingerprint')).toBe(
      "EXPORT (SELECT ID, NAME FROM MYTABLE) INTO CSV AT 'https://localhost:8563' PUBLIC KEY 'fingerprint' FILE '001.csv' REPLACE",
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
      "EXPORT MYTABLE INTO CSV AT 'https://localhost:8563' PUBLIC KEY 'fingerprint' FILE '001.csv' REPLACE COLUMN SEPARATOR = ';' COLUMN DELIMITER = '''' ROW SEPARATOR = 'CRLF' ENCODING = 'ASCII' NULL = 'N''ULL' WITH COLUMN NAMES",
    );
  });

  it('does not allow NONE as a CSV export row separator', () => {
    // @ts-expect-error NONE is only valid for FBV files.
    const rowSeparator: import('./types').CsvExportRowSeparator = RowSeparator.NONE;

    expect(rowSeparator).toBe(RowSeparator.NONE);
  });

  it.each([
    ['export.zip', '001.zip'],
    ['/tmp/.zip', '001.csv'], // invalid extension, defaults to .csv
    ['/tmp/export.zip', '001.zip'],
    ['/tmp/export.gz', '001.gz'],
    ['/tmp/export.bz2', '001.bz2'],
    ['/tmp/export.ZIP', '001.zip'],
    ['/tmp/export.csv', '001.csv'],
    ['/tmp/export.txt', '001.csv'],
  ])('uses %s to select remote export file %s', (filePath, fileName) => {
    expect(buildCsvExportSql('MYTABLE', { host: 'localhost', port: 8563 }, 'fingerprint', undefined, filePath)).toContain(
      `FILE '${fileName}'`,
    );
  });
});
