import { ClosePreparedStatementCommand, ExecutePreparedStatementCommand } from './commands';
import { Connection } from './connection';
import { ErrInvalidValuesCount } from './errors/errors';
import { ConnectionPool } from './pool/pool';
import { IStatement } from './sql-client.interface';
import { SQLQueriesResponse, SQLQueryColumn, SQLResponse } from './types';

// [impl->dsn~runtime-prepared-statement-execution~1]
export class Statement implements IStatement {
  constructor(
    private readonly connection: Connection,
    private readonly pool: ConnectionPool<Connection>,
    private readonly statementHandle: number,
    private readonly columns: SQLQueryColumn[]
  ) { }

  /**
   * @inheritDoc
   */
  async close(): Promise<void> {
    return this.connection
      .sendCommand(new ClosePreparedStatementCommand(this.statementHandle))
      .then(() => {
        this.pool.release(this.connection);
        return;
      })
      .catch((err) => {
        this.pool.release(this.connection);
        throw err;
      });
  }

  async [Symbol.asyncDispose](): Promise<void> {
    // [impl->dsn~runtime-prepared-statement-async-disposal~1]
    return this.close();
  }

  /**
   * @inheritDoc
   */
  async execute(...args: unknown[]): Promise<SQLResponse<SQLQueriesResponse>> {
    const columns = this.columns;
    if (args.length % columns.length !== 0) {
      return Promise.reject(ErrInvalidValuesCount);
    }

    // One independent array per column.
    const data: Array<(string | number | boolean | null)[]> = Array.from({ length: columns.length }, () => []);
    for (let index = 0; index < args.length; index++) {
      // Narrow to the primitive types the wire protocol supports.
      const arg = args[index] as string | number | boolean | null;
      // Arguments are laid out row-major, so this wraps back to column 0 at the start of each row.
      const colIndex = index % columns.length;
      data[colIndex].push(arg);
    }
    return this.connection
      .sendCommand<SQLQueriesResponse>(
        new ExecutePreparedStatementCommand({
          columns: this.columns,
          statementHandle: this.statementHandle,
          numColumns: this.columns.length,
          numRows: data[0].length,
          data: data,
        })
      )
      .catch((err) => {
        this.pool.release(this.connection);
        throw err;
      });
  }
}
