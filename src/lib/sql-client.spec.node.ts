import { ExasolDriver } from './sql-client';
import { WebSocket } from 'ws';
import { ExaWebsocket } from './connection';
import { createMockWebsocketFactory, MockWebsocketFactory } from './mock-socket';
import { IExasolDriver } from './sql-client.interface';

describe('sqlClient', () => {
  let mockSocketFactory: MockWebsocketFactory;
  let driver: IExasolDriver;

  beforeEach(() => {
    mockSocketFactory = createMockWebsocketFactory();
    driver = new ExasolDriver(mockSocketFactory.factory, { accessToken: 'access-token' });
  });

  describe('connect', () => {
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
  });

  describe('query', () => {
    it('should result set', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const queryPromise = driver.query('select 1');
      const result = await queryPromise;

      expect(result.getColumns()).toStrictEqual([{ name: 'A', dataType: { type: 'INTEGER' } }]);
      expect(result.getRows()).toStrictEqual([{ A: 1 }]);

      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
        command: 'execute',
        sqlText: 'select 1',
      });
    });
  });

  describe('execute', () => {
    it('should return row count', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const executePromise = driver.execute('create table test (id int)');
      const result = await executePromise;

      expect(result).toBe(1);
      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
        command: 'execute',
        sqlText: 'create table test (id int)',
      });
    });

    it.each([
      [
        'with sql exception details',
        { status: 'error', exception: { sqlCode: '42000', text: 'syntax error' } },
        "E-EDJS-25: SQL error: code: '42000', message: 'syntax error'",
      ],
      ['with missing exception details', { status: 'error' },
        'E-EDJS-27: Received error response with missing exception details.'],
    ])('should throw the expected error %s', async (_description, response, expectedMessage) => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const originalSend = mockSocketFactory.mockSocket.send.bind(mockSocketFactory.mockSocket);
      mockSocketFactory.mockSocket.send = (data: string | Uint8Array) => {
        const command = JSON.parse(data.toString());
        if (command.command === 'execute') {
          mockSocketFactory.mockSocket.sentCommands.push(command);
          setTimeout(() => {
            mockSocketFactory.mockSocket.callOnMessage({
              data: JSON.stringify(response),
            });
          }, 0);
          return;
        }
        originalSend(data);
      };

      await expect(driver.execute('invalid sql')).rejects.toThrow(expectedMessage);
    });
  });

  describe('importFromCsvFile', () => {
    it('should fail due to missing file', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      await expect(driver.importFromCsvFile('targetTable', '/tmp/missing')).rejects.toThrow("E-EDJS-14: Import file not found: '/tmp/missing'. Verify the file path exists and is readable.");
    });

    it('should fail due to tunnel connection failure', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      await expect(driver.importFromCsvFile('targetTable', 'README.md')).rejects.toThrow("E-EDJS-12: Failed to establish tunnel connection to Exasol at 'localhost':'8563': ''.");
    });
  });
});
