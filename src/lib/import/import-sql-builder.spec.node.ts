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

      expect(sql).toContain("COLUMN SEPARATOR = ','");
      expect(sql).toContain("COLUMN DELIMITER = '\"'");
      expect(sql).toContain("ROW SEPARATOR = 'CRLF'");
      expect(sql).toContain("ENCODING = 'UTF-8'");
      expect(sql).toContain('SKIP = 1');
      expect(sql).toContain("LTRIM");
      expect(sql).toContain("NULL = 'NULL'");
    });

    it('should escape apostrophes in CSV format option literals', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false, undefined, {
        columnDelimiter: "'",
      });

      expect(sql).toContain("COLUMN DELIMITER = ''''");
    });

    it('should escape apostrophes in column separator literal', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false, undefined, {
        columnSeparator: "'",
      });

      expect(sql).toContain("COLUMN SEPARATOR = ''''");
    });

    it('should escape apostrophes in row separator literal', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false, undefined, {
        rowSeparator: "O'CLOCK" as RowSeparator,
      });

      expect(sql).toContain("ROW SEPARATOR = 'O''CLOCK'");
    });

    it('should escape apostrophes in encoding literal', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false, undefined, {
        encoding: "UTF-'8" as 'UTF-8',
      });

      expect(sql).toContain("ENCODING = 'UTF-''8'");
    });

    it('should escape apostrophes in null literal', () => {
      const sql = buildCsvImportSql('TEST_TABLE', { host: '192.168.1.10', port: 4362 }, false, undefined, {
        null: "NU'LL",
      });

      expect(sql).toContain("NULL = 'NU''LL'");
    });
  });
});
