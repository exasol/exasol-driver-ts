import { SQLQueriesResponse, SQLQueryColumn, SQLResponse } from './types';
import { IStatement } from './sql-client.interface';
import { ErrInvalidValuesCount } from './errors/errors';
import { Connection } from './connection';
import { ClosePreparedStatementCommand, ExecutePreparedStatementCommand } from './commands';

export class Statement implements IStatement {
  constructor(
    private readonly connection: Connection,
    private readonly statementHandle: number,
    private readonly columns: SQLQueryColumn[],
  ) {}

  private async release(connection: Connection) {
    //TODO: clientConnection release, remove param and do the necessary
    connection.active = false;
  }

  /**
   * @inheritDoc
   */
  async close(): Promise<void> {
    return this.connection
      .sendCommand(new ClosePreparedStatementCommand(this.statementHandle))
      .then(() => {
        this.release(this.connection);
        return;
      })
      .catch((err) => {
        this.release(this.connection);
        throw err;
      });
  }

  /**
   * @inheritDoc
   */
  async execute(...args: unknown[]): Promise<SQLResponse<SQLQueriesResponse>> {
    const columns = this.columns;
    if (args.length % columns.length !== 0) {
      return Promise.reject(ErrInvalidValuesCount);
    }

    const data = Array(columns.length).fill([]);
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
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
        }),
      )
      .catch((err) => {
        this.release(this.connection);
        throw err;
      });
  }
}
