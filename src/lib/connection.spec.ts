import { AbortQueryCommand, CloseResultSetCommand } from './commands';
import { Connection, ExaWebsocket } from './connection';
import { Logger } from './logger/logger';
import { MockExaWebSocket } from './mock-socket';

describe('connection', () => {
  function createManualMockSocket(): MockExaWebSocket {
    const mockSocket = new MockExaWebSocket();
    mockSocket.send = (data: string | Uint8Array) => {
      mockSocket.sentCommands.push(JSON.parse(data.toString()));
    };
    return mockSocket;
  }

  it('requests ArrayBuffer frames for browser binary WebSocket responses', () => {
    const mockSocket = {
      send: jest.fn(),
      readyState: 1,
      binaryType: 'blob' as const,
    } as unknown as ExaWebsocket;

    new Connection(mockSocket, new Logger(), 'test');

    expect(mockSocket.binaryType).toBe('arraybuffer');
  });

  it('should work for sendCommandWithNoResult', async () => {
    const sendFunction = jest.fn();
    const mockSocket = {
      send: sendFunction,
      readyState: 1,
    } as unknown as ExaWebsocket;

    const connection = new Connection(mockSocket, new Logger(), 'test');

    await connection.sendCommandWithNoResult(new AbortQueryCommand());

    expect(sendFunction).toHaveBeenCalledWith('{"command":"abortQuery"}');
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
    const mockSocket = createManualMockSocket();
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
    const mockSocket = createManualMockSocket();
    const connection = new Connection(mockSocket, new Logger(), 'test');

    const command = connection.sendCommand({ command: 'execute', sqlText: 'select 1' });
    mockSocket.callOnError(new Error('connection reset'));

    await expect(command).rejects.toThrow("E-EDJS-16: Socket error: 'connection reset'");
    expect(connection.active).toBe(false);
    expect(connection.broken).toBe(true);
  });

  // [utest->dsn~runtime-response-command-serialization~1]
  it('serializes response-producing commands in FIFO order', async () => {
    const mockSocket = createManualMockSocket();
    const connection = new Connection(mockSocket, new Logger(), 'test');

    const firstCommand = connection.sendCommand({ command: 'execute', sqlText: 'select 1' });
    const secondCommand = connection.sendCommand(new CloseResultSetCommand([17]));

    expect(mockSocket.sentCommands).toEqual([{ command: 'execute', sqlText: 'select 1' }]);
    mockSocket.callOnMessage({ data: JSON.stringify({ status: 'ok', responseData: { command: 1 } }) });
    await expect(firstCommand).resolves.toEqual({ status: 'ok', responseData: { command: 1 } });
    expect(mockSocket.sentCommands).toEqual([
      { command: 'execute', sqlText: 'select 1' },
      { command: 'closeResultSet', resultSetHandles: [17] },
    ]);

    mockSocket.callOnMessage({ data: JSON.stringify({ status: 'ok', responseData: { command: 2 } }) });
    await expect(secondCommand).resolves.toEqual({ status: 'ok', responseData: { command: 2 } });
    expect(connection.active).toBe(false);
  });

  // [utest->dsn~runtime-response-command-serialization~1]
  it('sends abortQuery immediately while a response-producing command is pending', async () => {
    const mockSocket = createManualMockSocket();
    const connection = new Connection(mockSocket, new Logger(), 'test');
    let cancel: (() => void) | undefined;

    const command = connection.sendCommand({ command: 'execute', sqlText: 'select 1' }, (cancelCallback) => {
      cancel = cancelCallback;
    });
    cancel?.();

    expect(mockSocket.sentCommands).toEqual([
      { command: 'execute', sqlText: 'select 1' },
      { command: 'abortQuery' },
    ]);
    mockSocket.callOnMessage({ data: JSON.stringify({ status: 'ok' }) });
    await expect(command).resolves.toEqual({ status: 'ok' });
  });

  // [utest->dsn~runtime-inflight-websocket-failure~1]
  it('rejects active and queued commands when the WebSocket closes', async () => {
    const mockSocket = createManualMockSocket();
    const connection = new Connection(mockSocket, new Logger(), 'test');

    const firstCommand = connection.sendCommand({ command: 'execute', sqlText: 'select 1' });
    const secondCommand = connection.sendCommand({ command: 'execute', sqlText: 'select 2' });

    mockSocket.callOnClose({ code: 1006, reason: 'connection lost' });
    await expect(firstCommand).rejects.toThrow("E-EDJS-36: Socket closed: code '1006', reason 'connection lost'.");
    await expect(secondCommand).rejects.toThrow("E-EDJS-36: Socket closed: code '1006', reason 'connection lost'.");
  });

  // [utest->dsn~runtime-response-command-serialization~1]
  it('breaks and closes the connection for a malformed response frame', async () => {
    const mockSocket = createManualMockSocket();
    const connection = new Connection(mockSocket, new Logger(), 'test');

    const firstCommand = connection.sendCommand({ command: 'execute', sqlText: 'select 1' });
    const secondCommand = connection.sendCommand({ command: 'execute', sqlText: 'select 2' });
    mockSocket.callOnMessage({ data: '{not JSON}' });

    await expect(firstCommand).rejects.toThrow('E-EDJS-38: Malformed WebSocket response.');
    await expect(secondCommand).rejects.toThrow('E-EDJS-38: Malformed WebSocket response.');
    expect(connection.broken).toBe(true);
    expect(mockSocket.closed).toBe(true);
  });
});
