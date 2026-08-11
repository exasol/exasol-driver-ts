import { Statement } from './statement';
import { itWithAsyncDispose } from '../../test/test-utils';
import { Connection } from './connection';
import { ConnectionPool } from './pool/pool';
import { ExecutePreparedStatementCommand } from './commands';
import { SQLQueryColumn } from './types';
import { ErrInvalidValuesCount } from './errors/errors';

describe('statement', () => {
  const columns: SQLQueryColumn[] = [
    { name: 'A', dataType: { type: 'VARCHAR' } },
    { name: 'B', dataType: { type: 'DECIMAL' } },
    { name: 'C', dataType: { type: 'DECIMAL' } },
    { name: 'D', dataType: { type: 'VARCHAR' } },
  ];

  function createStatement(sendCommand: jest.Mock, statementColumns: SQLQueryColumn[] = columns) {
    const connection = { sendCommand } as unknown as Connection;
    const pool = { release: jest.fn() } as unknown as ConnectionPool<Connection>;
    const statement = new Statement(connection, pool, 1, statementColumns);
    return { statement, connection, pool };
  }

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

  it('should release the connection back to the pool when execute fails', async () => {
    const executeError = new Error('execute failed');
    const sendCommand = jest.fn().mockRejectedValue(executeError);
    const { statement, connection, pool } = createStatement(sendCommand);

    await expect(statement.execute('a', 'b', 'c', 'd')).rejects.toEqual(executeError);
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
  itWithAsyncDispose('should close the prepared statement when disposed with await using', async () => {
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

  it('should release the connection back to the pool when close fails', async () => {
    const closeError = new Error('close failed');
    const sendCommand = jest.fn().mockRejectedValue(closeError);
    const { statement, connection, pool } = createStatement(sendCommand);

    await expect(statement.close()).rejects.toEqual(closeError);
    expect(pool.release).toHaveBeenCalledWith(connection);
  });
});
