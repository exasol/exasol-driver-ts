import { ClosePreparedStatementCommand, ExecutePreparedStatementCommand } from './commands';
import { Connection } from './connection';
import { ErrInvalidValuesCount } from './errors/errors';
import { DEFAULT_FETCH_SIZE_BYTES, fetchData } from './fetch';
import { Logger, LogLevel } from './logger/logger';
import { ConnectionPool } from './pool/pool';
import { IStatement } from './sql-client.interface';
import { SQLQueriesResponse, SQLQueryColumn, SQLResponse } from './types';

/**
 * Fetches the remaining rows of all result sets in a response and closes their result-set handles.
 */
export type FetchResultSets = (data: SQLResponse<SQLQueriesResponse>, connection: Connection) => Promise<SQLResponse<SQLQueriesResponse>>;

const defaultFetchResultSets: FetchResultSets = (data, connection) =>
  fetchData(data, connection, new Logger(LogLevel.Off), DEFAULT_FETCH_SIZE_BYTES);

// [impl->dsn~runtime-prepared-statement-execution~2]
export class Statement implements IStatement {
  private closePromise: Promise<void> | undefined;

  constructor(
    private readonly connection: Connection,
    private readonly pool: ConnectionPool<Connection>,
    private readonly statementHandle: number,
    private readonly columns: SQLQueryColumn[],
    private readonly fetchResultSets: FetchResultSets = defaultFetchResultSets
  ) { }

  /**
   * @inheritDoc
   */
  async close(): Promise<void> {
    // Closing twice (e.g. close() inside an `await using` scope) would release a connection another caller may have
    // acquired in the meantime, so later calls share the result of the first one.
    this.closePromise ??= this.connection
      .sendCommand(new ClosePreparedStatementCommand(this.statementHandle))
      .then(() => {
        this.pool.release(this.connection);
        return;
      })
      .catch((err) => {
        this.pool.release(this.connection);
        throw err;
      });
    return this.closePromise;
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
      // Failures do not release the connection: the statement owns it until close(). Releasing it here would let the
      // pool hand it to another caller while the statement still uses it, and close() would release it a second time.
      .then((response) => this.fetchResultSets(response, this.connection));
  }
}
