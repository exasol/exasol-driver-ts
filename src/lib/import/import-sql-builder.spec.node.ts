import { buildCsvImportSql } from './import-sql-builder';
import { CsvFormatOptions, RowSeparator, TrimMode } from './types';

describe('import-sql-builder', () => {
  describe('buildCsvImportSql', () => {
    it('should generate IMPORT SQL', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, 'sha256//abc123');

      expect(sql).toBe("IMPORT INTO TEST_TABLE FROM CSV AT 'https://192.168.1.10:4362' PUBLIC KEY 'sha256//abc123' FILE '001.csv'");
    });

    it('should use schema-qualified table name as provided', () => {
      const sql = buildCsvImportSql('MYSCHEMA.MYTABLE', { host: '192.168.1.10', port: 4362 }, 'fingerprint');

      expect(sql).toBe("IMPORT INTO MYSCHEMA.MYTABLE FROM CSV AT 'https://192.168.1.10:4362' PUBLIC KEY 'fingerprint' FILE '001.csv'");
    });

    it('should not include format clauses when no CSV options are specified', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, 'fingerprint');

      expect(sql).not.toContain('COLUMN SEPARATOR');
      expect(sql).not.toContain('COLUMN DELIMITER');
      expect(sql).not.toContain('ROW SEPARATOR');
      expect(sql).not.toContain('ENCODING');
      expect(sql).not.toContain('SKIP');
      expect(sql).not.toContain('TRIM');
      expect(sql).not.toContain('NULL');
    });

    it.each<{ name: string; csvOptions?: CsvFormatOptions; expectedClauses: string[] }>([
      { name: 'no CSV options', csvOptions: undefined, expectedClauses: [] },
      { name: 'empty CSV options', csvOptions: {}, expectedClauses: [] },
      { name: 'column separator', csvOptions: { columnSeparator: ',' }, expectedClauses: ["COLUMN SEPARATOR = ','"] },
      { name: 'column delimiter', csvOptions: { columnDelimiter: '"' }, expectedClauses: ["COLUMN DELIMITER = '\"'"] },
      { name: 'row separator', csvOptions: { rowSeparator: RowSeparator.CRLF }, expectedClauses: ["ROW SEPARATOR = 'CRLF'"] },
      { name: 'encoding', csvOptions: { encoding: 'UTF-8' }, expectedClauses: ["ENCODING = 'UTF-8'"] },
      { name: 'skip rows', csvOptions: { skip: 1 }, expectedClauses: ['SKIP = 1'] },
      { name: 'trim none', csvOptions: { trim: TrimMode.NONE }, expectedClauses: [] },
      { name: 'trim leading', csvOptions: { trim: TrimMode.LEADING }, expectedClauses: ['LTRIM'] },
      { name: 'null representation', csvOptions: { null: 'NULL' }, expectedClauses: ["NULL = 'NULL'"] },
    ])('should build format clauses for $name', ({ csvOptions, expectedClauses }) => {
      const baseSql = "IMPORT INTO TEST_TABLE FROM CSV AT 'https://192.168.1.10:4362' PUBLIC KEY 'fingerprint' FILE '001.csv'";
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, 'fingerprint', csvOptions);
      const expectedSql = expectedClauses.length === 0 ? baseSql : `${baseSql} ${expectedClauses.join(' ')}`;

      expect(sql).toBe(expectedSql);
    });

    it('should include custom CSV format options', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, 'fingerprint', {
        columnSeparator: ',',
        columnDelimiter: '"',
        rowSeparator: RowSeparator.CRLF,
        encoding: 'UTF-8',
        skip: 1,
        trim: TrimMode.LEADING,
        null: 'NULL',
      });

      expect(sql).toBe(
        "IMPORT INTO TEST_TABLE FROM CSV AT 'https://192.168.1.10:4362' PUBLIC KEY 'fingerprint' FILE '001.csv' " +
        "COLUMN SEPARATOR = ',' " +
        "COLUMN DELIMITER = '\"' " +
        "ROW SEPARATOR = 'CRLF' " +
        "ENCODING = 'UTF-8' " +
        'SKIP = 1 ' +
        'LTRIM ' +
        "NULL = 'NULL'",
      );
    });

    it.each([
      [{ columnDelimiter: "'" }, "COLUMN DELIMITER = ''''"],
      [{ columnSeparator: "'" }, "COLUMN SEPARATOR = ''''"],
      [{ rowSeparator: "O'CLOCK" as RowSeparator }, "ROW SEPARATOR = 'O''CLOCK'"],
      [{ encoding: "UTF-'8" as 'UTF-8' }, "ENCODING = 'UTF-''8'"],
      [{ null: "NU'LL" }, "NULL = 'NU''LL'"],
    ])('should escape apostrophes in CSV option literals: %p', (csvOptions, expectedClause) => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, 'fingerprint', csvOptions);

      expect(sql).toContain(expectedClause);
    });
  });
});
