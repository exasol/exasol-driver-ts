import { buildCsvImportSql, buildCreateTableSql } from './import-sql-builder';

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
        rowSeparator: 'CRLF',
        encoding: 'UTF-8',
        skip: 1,
        trim: 'LTRIM',
        null: 'NULL',
      });

      expect(sql).toContain("COLUMN SEPARATOR = ','");
      expect(sql).toContain("COLUMN DELIMITER = '\"'");
      expect(sql).toContain("ROW SEPARATOR = 'CRLF'");
      expect(sql).toContain("ENCODING = 'UTF-8'");
      expect(sql).toContain('SKIP = 1');
      expect(sql).toContain("TRIM = 'LTRIM'");
      expect(sql).toContain("NULL = 'NULL'");
    });
  });

  describe('buildCreateTableSql', () => {
    it('should generate CREATE TABLE with quoted column names', () => {
      const sql = buildCreateTableSql('MY_TABLE', [
        { name: 'id', exasolType: 'DECIMAL(18,0)' },
        { name: 'name', exasolType: 'VARCHAR(2000000)' },
      ]);

      expect(sql).toBe('CREATE TABLE MY_TABLE ("id" DECIMAL(18,0), "name" VARCHAR(2000000))');
    });

    it('should generate CREATE TABLE with sanitized column names', () => {
      const sql = buildCreateTableSql(
        'MY_TABLE',
        [
          { name: 'My Column', exasolType: 'DECIMAL(18,0)' },
          { name: '1stValue', exasolType: 'DOUBLE' },
        ],
        'sanitized',
      );

      expect(sql).toBe('CREATE TABLE MY_TABLE (MY_COLUMN DECIMAL(18,0), _1STVALUE DOUBLE)');
    });

    it('should escape double quotes in quoted column names', () => {
      const sql = buildCreateTableSql('T', [{ name: 'col"name', exasolType: 'BOOLEAN' }]);

      expect(sql).toBe('CREATE TABLE T ("col""name" BOOLEAN)');
    });

    it('should handle empty column name in sanitized mode', () => {
      const sql = buildCreateTableSql('T', [{ name: '', exasolType: 'VARCHAR(2000000)' }], 'sanitized');

      expect(sql).toContain('"_"');
    });
  });
});
