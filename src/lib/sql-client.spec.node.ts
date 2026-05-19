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

