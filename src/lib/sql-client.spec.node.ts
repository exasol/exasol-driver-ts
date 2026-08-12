import { WebSocket } from 'ws';
import { ExaWebsocket } from './connection';
import { createMockWebsocketFactory, MockWebsocketFactory } from './mock-socket';
import { ExasolDriver } from './sql-client';
import { IExasolDriver } from './sql-client.interface';

describe('sqlClient', () => {
  let mockSocketFactory: MockWebsocketFactory;
  let driver: IExasolDriver;

  beforeEach(() => {
    mockSocketFactory = createMockWebsocketFactory();
    driver = new ExasolDriver(mockSocketFactory.factory, { accessToken: 'access-token' });
  });

  describe('connect', () => {
    // [utest->dsn~runtime-reject-missing-credentials~1]
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

    // [utest->dsn~runtime-driver-async-disposal~1]
    it('should close the connection when disposed with await using', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      {
        await using managedDriver = driver;
        await managedDriver.query('select 1');
      }

      expect(mockSocketFactory.mockSocket.closed).toBe(true);
    });
  });

  describe('query', () => {
    // [utest->dsn~runtime-query-execution~1]
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

    it('should return result set for default response type', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const result = await driver.query('select 1', undefined, undefined, 'default');

      expect(result.getColumns()).toStrictEqual([{ name: 'A', dataType: { type: 'INTEGER' } }]);
      expect(result.getRows()).toStrictEqual([{ A: 1 }]);
    });

    it('should return raw response for raw response type', async () => {
      // [utest->dsn~runtime-raw-response-execution~1]
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const result = await driver.query('select 1', undefined, undefined, 'raw');

      expect(result).toStrictEqual({
        status: 'ok',
        exception: undefined,
        responseData: {
          numResults: 1,
          results: [{
            resultType: 'resultSet',
            resultSet: {
              numColumns: 1,
              numRows: 1,
              numRowsInMessage: 1,
              columns: [{ name: 'A', dataType: { type: 'INTEGER' } }],
              data: [[1]],
            },
          }],
        },
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

      await expect(driver.query('invalid sql')).rejects.toThrow(expectedMessage);
    });
  });

  describe('execute', () => {
    // [utest->dsn~runtime-command-execution~1]
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

    it('should return row count for default response type', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const result = await driver.execute('create table test (id int)', undefined, undefined, 'default');

      expect(result).toBe(1);
    });

    it('should return raw response for raw response type', async () => {
      // [utest->dsn~runtime-raw-response-execution~1]
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const result = await driver.execute('create table test (id int)', undefined, undefined, 'raw');

      expect(result).toStrictEqual({
        status: 'ok',
        exception: undefined,
        responseData: {
          numResults: 1,
          results: [{ resultType: 'rowCount', rowCount: 1 }],
        },
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
    // [utest->dsn~runtime-csv-import-file-readability-check~1]
    it('should fail due to closed connection', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;
      await driver.close();

      await expect(driver.importFromCsvFile('targetTable', '/tmp/missing')).rejects.toThrow("E-EDJS-2: Connection was closed.");
    });

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

  describe('exportToCsvFile', () => {
    it('should fail due to closed connection', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;
      await driver.close();

      await expect(driver.exportToCsvFile('TARGET_TABLE', '/tmp/export.csv')).rejects.toThrow('E-EDJS-2: Connection was closed.');
    });
  });

  describe('cancel', () => {
    // [utest->dsn~runtime-query-cancellation~1]
    it('should send abort query command', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      await driver.cancel();

      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
        command: 'abortQuery',
      });
    });

    it('should reject when driver is closed', async () => {
      await driver.close();

      await expect(driver.cancel()).rejects.toThrow('E-EDJS-2: Connection was closed.');
    });

    it('should reject when no connection exists', async () => {
      await expect(driver.cancel()).rejects.toThrow('E-EDJS-1: Invalid connection.');
    });
  });
});
