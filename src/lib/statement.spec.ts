import { Statement } from './statement';
import { Connection } from './connection';
import { ConnectionPool } from './pool/pool';
import { ExecutePreparedStatementCommand } from './commands';
import { SQLQueriesResponse, SQLQueryColumn, SQLResponse } from './types';
import { ErrInvalidValuesCount } from './errors/errors';

describe('statement', () => {
  const columns: SQLQueryColumn[] = [
    { name: 'A', dataType: { type: 'VARCHAR' } },
    { name: 'B', dataType: { type: 'DECIMAL' } },
    { name: 'C', dataType: { type: 'DECIMAL' } },
    { name: 'D', dataType: { type: 'VARCHAR' } },
  ];

  function createStatement(sendCommand: jest.Mock, statementColumns: SQLQueryColumn[] = columns, fetchResultSets?: jest.Mock) {
    const connection = { sendCommand } as unknown as Connection;
    const pool = { release: jest.fn() } as unknown as ConnectionPool<Connection>;
    const statement = new Statement(connection, pool, 1, statementColumns, fetchResultSets);
    return { statement, connection, pool };
  }

  // [utest->dsn~runtime-prepared-statement-execution~2]
  it('should return the response with fetched result sets', async () => {
    const executeResponse = { status: 'ok', responseData: { numResults: 0, results: [] } };
    const fetchedResponse = { status: 'ok', responseData: { numResults: 1, results: [] } } as unknown as SQLResponse<SQLQueriesResponse>;
    const sendCommand = jest.fn().mockResolvedValue(executeResponse);
    const fetchResultSets = jest.fn().mockResolvedValue(fetchedResponse);
    const { statement, connection } = createStatement(sendCommand, columns, fetchResultSets);

    const response = await statement.execute('a', 'b', 'c', 'd');

    expect(response).toBe(fetchedResponse);
    expect(fetchResultSets).toHaveBeenCalledWith(executeResponse, connection);
  });

  it('should fetch and close result sets with the default fetch size when no fetch function is given', async () => {
    const executeResponse = {
      status: 'ok',
      responseData: {
        numResults: 1,
        results: [{
          resultType: 'resultSet',
          resultSet: { resultSetHandle: 17, numColumns: 1, numRows: 2, numRowsInMessage: 1, columns: [], data: [[1]] },
        }],
      },
    };
    const sendCommand = jest.fn().mockImplementation((command: { command: string }) => {
      if (command.command === 'fetch') {
        return Promise.resolve({ status: 'ok', responseData: { numRows: 1, data: [[2]] } });
      }
      return Promise.resolve(command.command === 'executePreparedStatement' ? executeResponse : {});
    });
    const { statement } = createStatement(sendCommand);

    const response = await statement.execute('a', 'b', 'c', 'd');

    expect(response.responseData.results[0].resultSet?.data).toEqual([[1, 2]]);
    expect(sendCommand).toHaveBeenCalledWith(expect.objectContaining({ command: 'fetch', numBytes: 1024 * 1024 }));
    expect(sendCommand).toHaveBeenCalledWith(expect.objectContaining({ command: 'closeResultSet', resultSetHandles: [17] }));
  });

  it('should keep the connection claimed until close when fetching result sets fails', async () => {
    const fetchError = new Error('fetch failed');
    const sendCommand = jest.fn().mockResolvedValue({});
    const fetchResultSets = jest.fn().mockRejectedValue(fetchError);
    const { statement, connection, pool } = createStatement(sendCommand, columns, fetchResultSets);

    await expect(statement.execute('a', 'b', 'c', 'd')).rejects.toEqual(fetchError);
    expect(pool.release).not.toHaveBeenCalled();

    await statement.close();
    expect(pool.release).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledWith(connection);
  });

  // Regression test for GitHub issue #71: with more than one placeholder, every column
  // used to end up with every argument because the columnar array was aliased.
  it('should send each argument in its own column when executing with multiple placeholders', async () => {
    const sendCommand = jest.fn().mockResolvedValue({});
    const { statement } = createStatement(sendCommand);

    await statement.execute('FIS WC', 2024, 1000, 'Christine');

    expect(sendCommand).toHaveBeenCalledTimes(1);
    const command = sendCommand.mock.calls[0][0] as ExecutePreparedStatementCommand;
    expect(command.numRows).toEqual(1);
    expect(command.numColumns).toEqual(4);
    expect(command.data).toEqual([['FIS WC'], [2024], [1000], ['Christine']]);
  });

  // Multi-row case: proves each column array is independent rather than the same
  // shared reference across all four columns.
  it('should not let separate columns share the same underlying array', async () => {
    const sendCommand = jest.fn().mockResolvedValue({});
    const { statement } = createStatement(sendCommand);

    await statement.execute('row1-a', 'row1-b', 'row1-c', 'row1-d', 'row2-a', 'row2-b', 'row2-c', 'row2-d');

    const command = sendCommand.mock.calls[0][0] as ExecutePreparedStatementCommand;
    expect(command.numRows).toEqual(2);
    expect(command.data).toEqual([
      ['row1-a', 'row2-a'],
      ['row1-b', 'row2-b'],
      ['row1-c', 'row2-c'],
      ['row1-d', 'row2-d'],
    ]);
  });

  // The bug never surfaced with a single placeholder because a one-element array is
  // never aliased; kept here as a baseline so a future change can't silently break it.
  it('should work correctly for a single placeholder', async () => {
    const sendCommand = jest.fn().mockResolvedValue({});
    const singleColumn: SQLQueryColumn[] = [{ name: 'A', dataType: { type: 'VARCHAR' } }];
    const { statement } = createStatement(sendCommand, singleColumn);

    await statement.execute('hello');

    const command = sendCommand.mock.calls[0][0] as ExecutePreparedStatementCommand;
    expect(command.data).toEqual([['hello']]);
  });

  it('should reject when the number of arguments is not a multiple of the column count', async () => {
    const sendCommand = jest.fn();
    const { statement } = createStatement(sendCommand);

    await expect(statement.execute('only-one-arg')).rejects.toEqual(ErrInvalidValuesCount);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('should keep the connection claimed until close when execute fails', async () => {
    const executeError = new Error('execute failed');
    const sendCommand = jest.fn().mockRejectedValueOnce(executeError).mockResolvedValue({});
    const { statement, connection, pool } = createStatement(sendCommand);

    await expect(statement.execute('a', 'b', 'c', 'd')).rejects.toEqual(executeError);
    expect(pool.release).not.toHaveBeenCalled();

    await statement.close();
    expect(pool.release).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledWith(connection);
  });

  it('should close the prepared statement and release the connection', async () => {
    const sendCommand = jest.fn().mockResolvedValue({});
    const { statement, connection, pool } = createStatement(sendCommand);

    await statement.close();

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledWith(connection);
  });

  // [utest->dsn~runtime-prepared-statement-async-disposal~1]
  it('should close the prepared statement when disposed with await using', async () => {
    const sendCommand = jest.fn().mockResolvedValue({});
    const { statement, connection, pool } = createStatement(sendCommand);

    {
      await using managedStatement = statement;
      await managedStatement.execute('a', 'b', 'c', 'd');
    }

    expect(sendCommand).toHaveBeenLastCalledWith(expect.objectContaining({
      command: 'closePreparedStatement',
    }));
    expect(pool.release).toHaveBeenCalledWith(connection);
  });

  it('should close the prepared statement and release the connection only once when closed twice', async () => {
    const sendCommand = jest.fn().mockResolvedValue({});
    const { statement, pool } = createStatement(sendCommand);

    {
      await using managedStatement = statement;
      await managedStatement.close();
    }

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledTimes(1);
  });

  it('should close only once when close is called concurrently', async () => {
    const sendCommand = jest.fn().mockResolvedValue({});
    const { statement, pool } = createStatement(sendCommand);

    await Promise.all([statement.close(), statement.close()]);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledTimes(1);
  });

  it('should return the error of the first close when close is called again after it failed', async () => {
    const closeError = new Error('close failed');
    const sendCommand = jest.fn().mockRejectedValue(closeError);
    const { statement, pool } = createStatement(sendCommand);

    await expect(statement.close()).rejects.toEqual(closeError);
    await expect(statement.close()).rejects.toEqual(closeError);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledTimes(1);
  });

  it('should release the connection back to the pool when close fails', async () => {
    const closeError = new Error('close failed');
    const sendCommand = jest.fn().mockRejectedValue(closeError);
    const { statement, connection, pool } = createStatement(sendCommand);

    await expect(statement.close()).rejects.toEqual(closeError);
    expect(pool.release).toHaveBeenCalledWith(connection);
  });
});
