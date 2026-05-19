import { ExasolDriver } from './sql-client';
import { WebSocket } from 'ws';
import { ExaWebsocket } from './connection';
import { createMockWebsocketFactory } from './mock-socket';

describe('sqlClient', () => {
  it('should fail with no credentials', async () => {
    expect.assertions(2);
    const driver = new ExasolDriver((url) => {
      return new WebSocket(url) as ExaWebsocket;
    }, {});
    return driver.connect().catch((err: Error) => {
      expect(err.message).toEqual('E-EDJS-6: Invalid credentials.');
      expect(err.name).toEqual('ExaError');
    });
  });

  it('should return row count for execute', async () => {
    const mockSocketFactory = createMockWebsocketFactory();

    const driver = new ExasolDriver(mockSocketFactory.factory, { accessToken: 'access-token' });

    const connectPromise = driver.connect();
    mockSocketFactory.mockSocket.simulateOpen({});
    await connectPromise;

    const executePromise = driver.query('select 1');
    const result = await executePromise;

    expect(result.getColumns()).toStrictEqual([{ name: 'A', dataType: { type: 'INTEGER' } }]);
    expect(result.getRows()).toStrictEqual([{ A: 1 }]);

    expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
      command: 'execute',
      sqlText: 'select 1',
    });
  });
});
