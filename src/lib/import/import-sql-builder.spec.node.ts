import { buildCsvImportSql } from './import-sql-builder';
import { RowSeparator, TrimMode } from './types';

describe('import-sql-builder', () => {
  describe('buildCsvImportSql', () => {
    it('should generate IMPORT SQL without encryption', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false);

      expect(sql).toBe("IMPORT INTO TEST_TABLE FROM CSV AT 'http://192.168.1.10:4362' FILE '001.csv'");
    });

    it('should generate IMPORT SQL with encryption', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, true, 'sha256//abc123');

      expect(sql).toBe("IMPORT INTO TEST_TABLE FROM CSV AT 'https://192.168.1.10:4362' PUBLIC KEY 'sha256//abc123' FILE '001.csv'");
    });

    it('should use schema-qualified table name as provided', () => {
      const sql = buildCsvImportSql('MYSCHEMA.MYTABLE', { host: '192.168.1.10', port: 4362 }, false);

      expect(sql).toBe("IMPORT INTO MYSCHEMA.MYTABLE FROM CSV AT 'http://192.168.1.10:4362' FILE '001.csv'");
    });

    it('should not include format clauses when no CSV options are specified', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false);

      expect(sql).not.toContain('COLUMN SEPARATOR');
      expect(sql).not.toContain('COLUMN DELIMITER');
      expect(sql).not.toContain('ROW SEPARATOR');
      expect(sql).not.toContain('ENCODING');
      expect(sql).not.toContain('SKIP');
      expect(sql).not.toContain('TRIM');
      expect(sql).not.toContain('NULL');
    });

    it('should include custom CSV format options', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false, undefined, {
        columnSeparator: ',',
        columnDelimiter: '"',
        rowSeparator: RowSeparator.CRLF,
        encoding: 'UTF-8',
        skip: 1,
        trim: TrimMode.LEADING,
        null: 'NULL',
      });

      expect(sql).toBe("IMPORT INTO TEST_TABLE FROM CSV AT 'http://192.168.1.10:4362' FILE '001.csv' "
        + "COLUMN SEPARATOR = ',' "
        + "COLUMN DELIMITER = '\"' "
        + "ROW SEPARATOR = 'CRLF' "
        + "ENCODING = 'UTF-8' "
        + "SKIP = 1 "
        + "LTRIM "
        + "NULL = 'NULL'");
    });

    it.each([
      [{ columnDelimiter: "'" }, "COLUMN DELIMITER = ''''"],
      [{ columnSeparator: "'" }, "COLUMN SEPARATOR = ''''"],
      [{ rowSeparator: "O'CLOCK" as RowSeparator }, "ROW SEPARATOR = 'O''CLOCK'"],
      [{ encoding: "UTF-'8" as 'UTF-8' }, "ENCODING = 'UTF-''8'"],
      [{ null: "NU'LL" }, "NULL = 'NU''LL'"],
    ])('should escape apostrophes in CSV option literals: %p', (csvOptions, expectedClause) => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false, undefined, csvOptions);

      expect(sql).toContain(expectedClause);
    });
  });
});
