import { ResultSet } from './types';

export class QueryResult {
  constructor(private readonly resultSet?: ResultSet) {}

  getColumns() {
    return this.resultSet?.columns ?? [];
  }

  getRows(): {
    [column: string]: string | number | boolean | null;
  }[] {
    const result = [];
    const data = this.resultSet?.data ?? [];

    const columns = this.getColumns();

    for (let index = 0; index < (this.resultSet?.numRowsInMessage ?? 0); index++) {
      const row: { [column: string]: string | number | boolean | null } = {};

      for (let rowIndex = 0; rowIndex < columns.length; rowIndex++) {
        const element = data[rowIndex][index];
        row[columns[rowIndex].name] = element;
      }

      result.push(row);
    }

    return result;
  }
}
