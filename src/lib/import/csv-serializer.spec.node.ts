import { serializeRowsToCsv } from './csv-serializer';

describe('csv-serializer', () => {
  it('should serialize simple rows', () => {
    const rows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const csv = serializeRowsToCsv(rows, ['id', 'name']);

    expect(csv).toBe('1,Alice\n2,Bob\n');
  });

  it('should handle NULL values as empty string by default', () => {
    const rows = [{ id: 1, name: null }];

    const csv = serializeRowsToCsv(rows, ['id', 'name']);

    expect(csv).toBe('1,\n');
  });

  it('should use custom null string', () => {
    const rows = [{ id: 1, name: null }];

    const csv = serializeRowsToCsv(rows, ['id', 'name'], { null: 'NULL' });

    expect(csv).toBe('1,NULL\n');
  });

  it('should quote fields containing separator', () => {
    const rows = [{ val: 'hello,world' }];

    const csv = serializeRowsToCsv(rows, ['val']);

    expect(csv).toBe('"hello,world"\n');
  });

  it('should escape delimiter characters within fields', () => {
    const rows = [{ val: 'say "hello"' }];

    const csv = serializeRowsToCsv(rows, ['val']);

    expect(csv).toBe('"say ""hello"""\n');
  });

  it('should quote fields containing newlines', () => {
    const rows = [{ val: 'line1\nline2' }];

    const csv = serializeRowsToCsv(rows, ['val']);

    expect(csv).toBe('"line1\nline2"\n');
  });

  it('should use custom separator', () => {
    const rows = [{ a: 1, b: 2 }];

    const csv = serializeRowsToCsv(rows, ['a', 'b'], { columnSeparator: ';' });

    expect(csv).toBe('1;2\n');
  });

  it('should return empty string for empty rows', () => {
    const csv = serializeRowsToCsv([], ['id']);

    expect(csv).toBe('');
  });

  it('should handle undefined values as null', () => {
    const rows = [{ id: 1 }];

    const csv = serializeRowsToCsv(rows, ['id', 'missing']);

    expect(csv).toBe('1,\n');
  });
});
