import { DisconnectCommand } from './commands';
import { Connection, ExaWebsocket } from './connection';
import { Logger } from './logger/logger';
import { MockExaWebSocket } from './mock-socket';

describe('connection', () => {
  it('should work for sendCommandWithNoResult', async () => {
    const sendFunction = jest.fn();
    const mockSocket = {
      send: sendFunction,
      readyState: 1,
    } as unknown as ExaWebsocket;

    const connection = new Connection(mockSocket, new Logger(), 'test');

    await connection.sendCommandWithNoResult(new DisconnectCommand());

    expect(sendFunction).toHaveBeenCalledWith('{"command":"disconnect"}');
  });

  it('should work for sendCommandWithNoResult (reject if closed)', async () => {
    const sendFunction = jest.fn();
    const mockSocket = {
      send: sendFunction,
      readyState: 2,
    } as unknown as ExaWebsocket;

    expect.assertions(3);
    const connection = new Connection(mockSocket, new Logger(), 'test');
    return connection.sendCommand({ command: 'disconnect' }).catch((err: Error) => {
      expect(err.message).toEqual('E-EDJS-2: Connection was closed.');
      expect(err.name).toEqual('ExaError');
      expect(sendFunction).not.toHaveBeenCalled();
    });
  });

  it('should reject sendCommand if not connected', async () => {
    const connection = new Connection(undefined as unknown as ExaWebsocket, new Logger(), 'test');

    await expect(connection.sendCommand({ command: 'disconnect' })).rejects.toThrow("E-EDJS-19: Not connected.");
    expect(connection.broken).toBe(true);
  });

  it('should work for sendCommand', async () => {
    const sendFunction = jest.fn();
    const mockSocket = {
      send: sendFunction,
      readyState: 1,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onmessage: (_response?: unknown) => {
        /** Empty */
      },
    } as unknown as ExaWebsocket;

    const connection = new Connection(mockSocket, new Logger(), 'test');

    const result = new Promise((resolve) => {
      setTimeout(() => {
        if (mockSocket.onmessage) {
          mockSocket.onmessage({
            data: JSON.stringify({
              status: 'ok',
            }),
          });
        }
        resolve(undefined);
      }, 500);
    });

    const [data] = await Promise.all([
      connection.sendCommand({
        command: 'closePreparedStatement',
        statementHandle: 2,
      }),
      result,
    ]);

    expect(data).toEqual({
      status: 'ok',
    });
    expect(sendFunction).toHaveBeenCalledWith('{"command":"closePreparedStatement","statementHandle":2}');
  });

  // [utest->dsn~runtime-inflight-websocket-failure~1]
  it('rejects an in-flight command when the WebSocket closes', async () => {
    const mockSocket = new MockExaWebSocket();
    const connection = new Connection(mockSocket, new Logger(), 'test');

    const command = connection.sendCommand({ command: 'execute', sqlText: 'select 1' });
    expect(connection.active).toBe(true);

    mockSocket.callOnClose({ code: 1006, reason: 'connection lost' });

    await expect(command).rejects.toThrow("E-EDJS-36: Socket closed: code '1006', reason 'connection lost'.");
    expect(connection.active).toBe(false);
    expect(connection.broken).toBe(true);
  });

  // [utest->dsn~runtime-inflight-websocket-failure~1]
  it('rejects an in-flight command when the WebSocket errors', async () => {
    const mockSocket = new MockExaWebSocket();
    const connection = new Connection(mockSocket, new Logger(), 'test');

    const command = connection.sendCommand({ command: 'execute', sqlText: 'select 1' });
    mockSocket.callOnError(new Error('connection reset'));

    await expect(command).rejects.toThrow("E-EDJS-16: Socket error: 'connection reset'");
    expect(connection.active).toBe(false);
    expect(connection.broken).toBe(true);
  });

  // [utest->dsn~runtime-inflight-websocket-failure~1]
  it('rejects a parallel command while another command is active', async () => {
    const mockSocket = new MockExaWebSocket();
    const connection = new Connection(mockSocket, new Logger(), 'test');

    const firstCommand = connection.sendCommand({ command: 'execute', sqlText: 'select 1' });

    await expect(connection.sendCommand({ command: 'execute', sqlText: 'select 1' })).rejects.toThrow('E-EDJS-7: Another query is already running.');
    mockSocket.callOnClose({ code: 1006, reason: 'connection lost' });
    await expect(firstCommand).rejects.toThrow("E-EDJS-36: Socket closed: code '1006', reason 'connection lost'.");
  });
});
