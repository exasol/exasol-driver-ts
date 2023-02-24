/* eslint-disable jest/no-conditional-expect */

import { DisconnectCommand } from './commands';
import { Connection, ExaWebsocket } from './connection';
import { Logger } from './logger/logger';

describe('connection', () => {
  it('should work for sendCommandWithNoResult', async () => {
    const sendFunction = jest.fn();
    const mockSocket = {
      send: sendFunction,
      readyState: 1,
    } as unknown as ExaWebsocket;

    const connection = new Connection(mockSocket, new Logger(), 'test');

    await connection.sendCommandWithNoResult(new DisconnectCommand());

    // eslint-disable-next-line quotes
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
    // eslint-disable-next-line quotes
    expect(sendFunction).toHaveBeenCalledWith('{"command":"closePreparedStatement","statementHandle":2}');
  });
});
