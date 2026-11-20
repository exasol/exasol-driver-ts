import { WebSocket } from 'ws';
import { ExaWebsocket, ReadyState } from './connection';
import { createMockWebsocketFactory, MockWebsocketFactory, MultiHostMockWebsocketFactory } from './mock-socket';
import { NodeExasolDriver as ExasolDriver } from './node-sql-client';
import { NodeExasolPool } from './node-sql-pool';
import { IExasolDriver } from './sql-client.interface';

describe('sqlClient', () => {
  let mockSocketFactory: MockWebsocketFactory;
  let driver: IExasolDriver;

  function completeWithin<T>(promise: Promise<T>, timeoutMessage: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(timeoutMessage)), 100);
      void promise.then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
  }

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

    // [utest->dsn~runtime-login-metadata~1]
    it('sends configured metadata during token authentication', async () => {
      driver = new ExasolDriver(mockSocketFactory.factory, {
        accessToken: 'access-token',
        clientOs: 'configured-os',
        clientOsUsername: 'configured-user',
        clientRuntime: 'configured-runtime',
      });
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual(
        expect.objectContaining({
          accessToken: 'access-token',
          clientOs: 'configured-os',
          clientOsUsername: 'configured-user',
          clientRuntime: 'configured-runtime',
        }),
      );
    });

    // [utest->dsn~runtime-inflight-websocket-failure~1]
    it('calls onClose and rejects an in-flight command when the WebSocket closes', async () => {
      const onClose = jest.fn();
      driver = new ExasolDriver(mockSocketFactory.factory, { accessToken: 'access-token', onClose });
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      let commandSent: (() => void) | undefined;
      const sent = new Promise<void>((resolve) => {
        commandSent = resolve;
      });
      mockSocketFactory.mockSocket.send = (data: string | Uint8Array) => {
        const command = JSON.parse(data.toString());
        mockSocketFactory.mockSocket.sentCommands.push(command);
        if (command.command === 'execute') {
          commandSent?.();
        }
      };
      const query = driver.query('select 1');
      await sent;
      mockSocketFactory.mockSocket.readyState = ReadyState.CLOSED;
      mockSocketFactory.mockSocket.callOnClose({ code: 1006, reason: 'connection lost' });

      await expect(query).rejects.toThrow("E-EDJS-36: Socket closed: code '1006', reason 'connection lost'.");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    // [utest->dsn~runtime-inflight-websocket-failure~1]
    it('calls onError and rejects an in-flight command when the WebSocket errors after connecting', async () => {
      const onError = jest.fn();
      driver = new ExasolDriver(mockSocketFactory.factory, { accessToken: 'access-token', onError });
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      let commandSent: (() => void) | undefined;
      const sent = new Promise<void>((resolve) => {
        commandSent = resolve;
      });
      mockSocketFactory.mockSocket.send = (data: string | Uint8Array) => {
        const command = JSON.parse(data.toString());
        mockSocketFactory.mockSocket.sentCommands.push(command);
        if (command.command === 'execute') {
          commandSent?.();
        }
      };

      const query = driver.query('select 1');
      await sent;
      mockSocketFactory.mockSocket.callOnError(new Error('connection reset'));

      await expect(completeWithin(
        query,
        'WebSocket error did not reject the in-flight query within 100 ms.',
      )).rejects.toThrow("E-EDJS-16: Socket error: 'connection reset'");
      expect(onError).toHaveBeenCalledTimes(1);
      expect(mockSocketFactory.mockSocket.closed).toBe(true);
      await expect(driver.query('select 1')).rejects.toThrow('E-EDJS-2: Connection was closed.');
    });
  });

  describe('query', () => {
    // [utest->dsn~runtime-query-execution~3]
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

    it('should consume the result set close response before reusing the connection', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      await driver.query('select with multiple rows');
      const result = await driver.query('select 1');

      expect(result.getRows()).toStrictEqual([{ A: 1 }]);
      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
        command: 'closeResultSet',
        resultSetHandles: [17],
      });
    });

    it('should return fetched rows when closing the result set fails', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const originalSend = mockSocketFactory.mockSocket.send.bind(mockSocketFactory.mockSocket);
      mockSocketFactory.mockSocket.send = (data: string | Uint8Array) => {
        const command = JSON.parse(data.toString());
        if (command.command === 'closeResultSet') {
          mockSocketFactory.mockSocket.sentCommands.push(command);
          setTimeout(() => {
            mockSocketFactory.mockSocket.callOnMessage({
              data: JSON.stringify({ status: 'error' }),
            });
          }, 0);
          return;
        }
        originalSend(data);
      };

      const result = await driver.query('select with multiple rows');

      expect(result.getRows()).toStrictEqual([{ A: 1 }, { A: 2 }]);
    });

    // [utest->dsn~runtime-query-fetch-size~1]
    it('should use the configured fetch size in fetch commands', async () => {
      driver = new ExasolDriver(mockSocketFactory.factory, { accessToken: 'access-token', fetchSize: 42 });
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      const result = await driver.query('select with multiple rows');

      expect(result.getRows()).toStrictEqual([{ A: 1 }, { A: 2 }]);
      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
        command: 'fetch',
        resultSetHandle: 17,
        startPosition: 1,
        numBytes: 42,
      });
    });

    it('should use the default fetch size in fetch commands', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      await driver.query('select with multiple rows');

      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
        command: 'fetch',
        resultSetHandle: 17,
        startPosition: 1,
        numBytes: 1024 * 1024,
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

    it('should use the configured fetch size in fetch commands', async () => {
      driver = new ExasolDriver(mockSocketFactory.factory, { accessToken: 'access-token', fetchSize: 42 });
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      await driver.execute('select with multiple rows', undefined, undefined, 'raw');

      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
        command: 'fetch',
        resultSetHandle: 17,
        startPosition: 1,
        numBytes: 42,
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

  describe('connect with connection string', () => {
    const keepDsnOrder = () => jest.spyOn(Math, 'random').mockReturnValue(0.999);

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('uses the port from the connection string instead of the configured port', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1:8888', port: 8563 });

      await driver.connect();

      expect(factory.urls).toEqual(['wss://exasol1:8888']);
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('tries the hosts in turn until one opens', async () => {
      keepDsnOrder();
      const factory = new MultiHostMockWebsocketFactory({ 'wss://exasol3:8563': 'open' });
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1..4' });

      await driver.connect();

      expect(factory.urls).toEqual(['wss://exasol1:8563', 'wss://exasol2:8563', 'wss://exasol3:8563']);
      await expect(driver.query('select 1')).resolves.toBeDefined();
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('tries the hosts in random order', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1..3' });

      await driver.connect();

      expect(factory.urls).toEqual(['wss://exasol2:8563']);
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('fails with all hosts and their causes when no host can be opened', async () => {
      keepDsnOrder();
      const onError = jest.fn();
      const factory = new MultiHostMockWebsocketFactory({ 'wss://exasol2:8563': 'close' });
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1,exasol2', onError });

      await expect(driver.connect()).rejects.toThrow(
        "E-EDJS-42: Could not connect to Exasol. Tried '2' host(s): " +
          "'wss://exasol1:8563: E-EDJS-16: Socket error: 'connection refused'; " +
          "wss://exasol2:8563: E-EDJS-36: Socket closed: code '1006', reason 'abnormal closure'.'.",
      );
      expect(onError).toHaveBeenCalledTimes(1);
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('treats an exception from the WebSocket factory as a failed host', async () => {
      keepDsnOrder();
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver((url) => {
        if (url.includes('exasol1')) {
          throw new Error('invalid URL');
        }
        return factory.factory(url);
      }, { accessToken: 'access-token', host: 'exasol1,exasol2' });

      await driver.connect();

      expect(factory.urls).toEqual(['wss://exasol2:8563']);
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('allows connecting again after all hosts failed', async () => {
      const behaviors: Record<string, 'open' | 'error'> = { 'wss://exasol1:8563': 'error' };
      const factory = new MultiHostMockWebsocketFactory(behaviors);
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1' });
      await expect(driver.connect()).rejects.toThrow('E-EDJS-42');

      behaviors['wss://exasol1:8563'] = 'open';

      await expect(driver.connect()).resolves.toBeUndefined();
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('does not try another host when login fails', async () => {
      keepDsnOrder();
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'invalid-token', host: 'exasol1,exasol2' });

      await expect(driver.connect()).rejects.toThrow();

      expect(factory.urls).toEqual(['wss://exasol1:8563']);
    });

    // [utest->dsn~runtime-dsn-connect-timeout~1]
    it('rejects without trying another host when the login times out', async () => {
      keepDsnOrder();
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'silent-token', host: 'exasol1,exasol2', connectTimeout: 20 });

      await expect(driver.connect()).rejects.toThrow("E-EDJS-44: Login timed out after '20' ms.");

      expect(factory.urls).toEqual(['wss://exasol1:8563']);
      expect(factory.sockets[0].closed).toBe(true);
      await expect(driver.cancel()).rejects.toThrow('E-EDJS-1: Invalid connection.');
    });

    // [utest->dsn~runtime-dsn-connect-timeout~1]
    it('does not time out a login that completes in time', async () => {
      jest.useFakeTimers();
      try {
        const factory = new MultiHostMockWebsocketFactory({}, 'open');
        driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1' });
        const connectPromise = driver.connect();
        await jest.advanceTimersByTimeAsync(10);
        await expect(connectPromise).resolves.toBeUndefined();

        await jest.advanceTimersByTimeAsync(60_000);
        expect(factory.sockets[0].closed).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('rejects with the connection error when the onError callback throws', async () => {
      const onError = jest.fn(() => {
        throw new Error('callback failed');
      });
      const factory = new MultiHostMockWebsocketFactory({}, 'error');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1', onError });

      await expect(driver.connect()).rejects.toThrow('E-EDJS-42');
      expect(onError).toHaveBeenCalledTimes(1);
    });

    // [utest->dsn~runtime-discard-failed-login-connection~1]
    it('closes the WebSocket and discards the connection when login fails', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'rejected-token', host: 'exasol1' });

      await expect(driver.connect()).rejects.toEqual({ sqlCode: '08004', text: 'authentication failed' });

      expect(factory.sockets[0].closed).toBe(true);
      await expect(driver.cancel()).rejects.toThrow('E-EDJS-1: Invalid connection.');
    });

    // [utest->dsn~runtime-discard-failed-login-connection~1]
    it('closes the WebSocket when the connection cannot be added to the pool', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1' });
      await driver.connect();

      await expect(driver.connect()).rejects.toThrow('E-EDJS-8');

      expect(factory.sockets[1].closed).toBe(true);
      expect(factory.sockets[0].closed).toBe(false);
      await expect(driver.query('select 1')).resolves.toBeDefined();
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it.each([20, 0])('stops trying hosts when the driver is closed while connecting (connectTimeout %p)', async (connectTimeout) => {
      keepDsnOrder();
      const onError = jest.fn();
      const factory = new MultiHostMockWebsocketFactory({ 'wss://exasol1:8563': 'hang', 'wss://exasol2:8563': 'open' });
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1,exasol2', connectTimeout, onError });

      const connectPromise = driver.connect();
      await driver.close();

      await expect(connectPromise).rejects.toThrow('E-EDJS-2: Connection was closed.');
      expect(factory.urls).toEqual(['wss://exasol1:8563']);
      expect(factory.sockets[0].closed).toBe(true);
      expect(onError).not.toHaveBeenCalled();
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('does not log in when the driver is closed after the WebSocket opened', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'hang');
      driver = new ExasolDriver((url) => {
        const socket = factory.factory(url);
        setTimeout(() => {
          socket.onopen?.(undefined);
          // close() runs before connect() continues after the open event
          void driver.close();
        }, 0);
        return socket;
      }, { accessToken: 'access-token', host: 'exasol1' });

      await expect(driver.connect()).rejects.toThrow('E-EDJS-2: Connection was closed.');
      expect(factory.sockets[0].closed).toBe(true);
      expect(factory.sockets[0].sentCommands).toEqual([]);
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('rejects when the driver is closed during the login', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver((url) => {
        const socket = factory.factory(url);
        const send = socket.send.bind(socket);
        socket.send = (data) => {
          send(data);
          // Close the driver after the last login command was sent, before its response arrives.
          if (data.toString().includes('"accessToken"')) {
            void driver.close();
          }
        };
        return socket;
      }, { accessToken: 'access-token', host: 'exasol1' });

      await expect(driver.connect()).rejects.toThrow('E-EDJS-2: Connection was closed.');
      expect(factory.sockets[0].sentCommands).toContainEqual(expect.objectContaining({ accessToken: 'access-token' }));
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('does not open a WebSocket when connecting a closed driver', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1' });
      await driver.close();

      await expect(driver.connect()).rejects.toThrow('E-EDJS-2: Connection was closed.');
      expect(factory.urls).toEqual([]);
    });

    // [utest->dsn~runtime-dsn-tunnel-address~1]
    it('checks the import file before connecting', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'error');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1..3' });

      await expect(driver.importFromCsvFile('targetTable', '/tmp/missing')).rejects.toThrow('E-EDJS-14');
      expect(factory.urls).toEqual([]);
    });

    // [utest->dsn~runtime-dsn-tunnel-address~1]
    it('checks the abort signal before connecting', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1' });
      const controller = new AbortController();
      controller.abort();

      await expect(driver.importFromCsvFile('targetTable', 'README.md', undefined, { signal: controller.signal })).rejects.toThrow('E-EDJS-20');
      await expect(driver.exportToCsvFile('TARGET_TABLE', '/tmp/never-created.csv', undefined, { signal: controller.signal })).rejects.toThrow();
      expect(factory.urls).toEqual([]);
    });

    // [utest->dsn~runtime-dsn-tunnel-address~1]
    it('stops waiting for the connection when the import is aborted', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'hang');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1', connectTimeout: 0 });
      const controller = new AbortController();

      const importPromise = driver.importFromCsvFile('targetTable', 'README.md', undefined, { signal: controller.signal });
      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort();

      await expect(importPromise).rejects.toThrow('E-EDJS-20');
      await driver.close();
      expect(factory.sockets[0].closed).toBe(true);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('rejects an explicitly undefined host with E-EDJS-39', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: undefined });

      await expect(driver.connect()).rejects.toThrow("E-EDJS-39: Invalid connection string 'undefined'.");
      expect(factory.urls).toEqual([]);
    });

    // [utest->dsn~runtime-dsn-connect-timeout~1]
    it('tries the next host when opening the WebSocket times out', async () => {
      keepDsnOrder();
      const factory = new MultiHostMockWebsocketFactory({ 'wss://exasol1:8563': 'hang', 'wss://exasol2:8563': 'open' });
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1,exasol2', connectTimeout: 20 });

      await driver.connect();

      expect(factory.urls).toEqual(['wss://exasol1:8563', 'wss://exasol2:8563']);
      expect(factory.sockets[0].closed).toBe(true);
    });

    // [utest->dsn~runtime-dsn-connect-timeout~1]
    it('reports the timeout in the connection error', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'hang');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1', connectTimeout: 20 });

      await expect(driver.connect()).rejects.toThrow(
        "E-EDJS-42: Could not connect to Exasol. Tried '1' host(s): 'wss://exasol1:8563: E-EDJS-41: Opening WebSocket 'wss://exasol1:8563' timed out after '20' ms.'.",
      );
    });

    // [utest->dsn~runtime-dsn-connect-timeout~1]
    it('uses a default connect timeout of 20000 ms', async () => {
      jest.useFakeTimers();
      try {
        const factory = new MultiHostMockWebsocketFactory({}, 'hang');
        driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1' });
        const connectPromise = driver.connect();
        const assertion = expect(connectPromise).rejects.toThrow("timed out after '20000' ms");

        await jest.advanceTimersByTimeAsync(19999);
        expect(factory.sockets[0].closed).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await assertion;
      } finally {
        jest.useRealTimers();
      }
    });

    // [utest->dsn~runtime-dsn-connect-timeout~1]
    it.each([0, -1, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER, 2_147_483_648])('disables the connect timeout for %p', async (connectTimeout) => {
      jest.useFakeTimers();
      try {
        const factory = new MultiHostMockWebsocketFactory({}, 'hang');
        driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1', connectTimeout });
        const connectPromise = driver.connect();
        let settled = false;
        connectPromise.then(() => (settled = true), () => (settled = true));

        await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

        expect(settled).toBe(false);
        expect(factory.sockets[0].closed).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('connects to an IPv6 address in brackets', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: '[::1]', port: 8563 });

      await driver.connect();

      expect(factory.urls).toEqual(['wss://[::1]:8563']);
    });

    // [utest->dsn~runtime-dsn-reject-fingerprint~1]
    it('rejects a connection string with a fingerprint before opening a WebSocket', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: '10.0.0.11/135a1d2dce10,exasol2' });

      await expect(driver.connect()).rejects.toThrow(
        "E-EDJS-40: Connection string contains a certificate fingerprint for host '10.0.0.11', but fingerprint validation is not supported yet.",
      );
      expect(factory.urls).toEqual([]);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('rejects an invalid connection string before opening a WebSocket', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol3..1' });

      await expect(driver.connect()).rejects.toThrow("E-EDJS-9: Invalid host range limits: 'exasol3..1'.");
      expect(factory.urls).toEqual([]);
    });

    it('uses the configured URL without parsing the host', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol3..1', url: 'wss://exasol:8563' });

      await driver.connect();

      expect(factory.urls).toEqual(['wss://exasol:8563']);
    });

    // [utest->dsn~runtime-dsn-tunnel-address~1]
    it('opens the import tunnel to the connected host', async () => {
      keepDsnOrder();
      const factory = new MultiHostMockWebsocketFactory({ 'wss://127.0.0.1:1': 'open' });
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'unreachable.invalid,127.0.0.1:1' });

      await expect(driver.importFromCsvFile('targetTable', 'README.md')).rejects.toThrow(
        "E-EDJS-12: Failed to establish tunnel connection to Exasol at '127.0.0.1':'1'",
      );
      expect(factory.urls).toEqual(['wss://unreachable.invalid:1', 'wss://127.0.0.1:1']);
    });

    // [utest->dsn~runtime-dsn-tunnel-address~1]
    it('opens the import tunnel to the host of the live connection without reconnecting', async () => {
      keepDsnOrder();
      const factory = new MultiHostMockWebsocketFactory({ 'wss://127.0.0.1:1': 'open' });
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1,127.0.0.1:1' });
      await driver.connect();

      await expect(driver.importFromCsvFile('targetTable', 'README.md')).rejects.toThrow(
        "E-EDJS-12: Failed to establish tunnel connection to Exasol at '127.0.0.1':'1'",
      );
      expect(factory.urls).toEqual(['wss://exasol1:1', 'wss://127.0.0.1:1']);
    });

    // [utest->dsn~runtime-dsn-tunnel-address~1]
    it('reconnects before opening the import tunnel when the connection to the previous host broke', async () => {
      keepDsnOrder();
      const behaviors: Record<string, 'open' | 'error'> = { 'wss://exasol1:1': 'open', 'wss://127.0.0.1:1': 'open' };
      const factory = new MultiHostMockWebsocketFactory(behaviors);
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1,127.0.0.1:1' });
      await driver.connect();
      expect(factory.urls).toEqual(['wss://exasol1:1']);

      behaviors['wss://exasol1:1'] = 'error';
      factory.sockets[0].callOnClose({ code: 1006, reason: 'node down' });

      await expect(driver.importFromCsvFile('targetTable', 'README.md')).rejects.toThrow(
        "E-EDJS-12: Failed to establish tunnel connection to Exasol at '127.0.0.1':'1'",
      );
      expect(factory.urls).toEqual(['wss://exasol1:1', 'wss://exasol1:1', 'wss://127.0.0.1:1']);
    });

    // [utest->dsn~runtime-dsn-tunnel-address~1]
    it('removes the IPv6 brackets of the configured host for the import tunnel when a URL is configured', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: '[::1]', port: 1, url: 'wss://[::1]:8563' });

      await expect(driver.importFromCsvFile('targetTable', 'README.md')).rejects.toThrow(
        "E-EDJS-12: Failed to establish tunnel connection to Exasol at '::1':'1'",
      );
    });

    // [utest->dsn~runtime-dsn-tunnel-address~1]
    it('opens the import tunnel to the configured host and port when a URL is configured', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: '127.0.0.1', port: 1, url: 'wss://gateway:8563/exasol' });

      await expect(driver.importFromCsvFile('targetTable', 'README.md')).rejects.toThrow(
        "E-EDJS-12: Failed to establish tunnel connection to Exasol at '127.0.0.1':'1'",
      );
    });

    // [utest->dsn~runtime-dsn-failover~1]
    it('fails over in each connection of a pool', async () => {
      keepDsnOrder();
      const factory = new MultiHostMockWebsocketFactory({ 'wss://exasol2:8563': 'open' });
      const pool = new NodeExasolPool(factory.factory, { accessToken: 'access-token', host: 'exasol1,exasol2' });
      try {
        await expect(pool.query('select 1')).resolves.toBeDefined();
        expect(factory.urls).toEqual(['wss://exasol1:8563', 'wss://exasol2:8563']);
      } finally {
        await pool.drain();
        await pool.clear();
      }
    });
  });

  describe('executeBatch', () => {
    it('should use the configured fetch size in fetch commands', async () => {
      driver = new ExasolDriver(mockSocketFactory.factory, { accessToken: 'access-token', fetchSize: 42 });
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      await driver.executeBatch(['select with multiple rows']);

      expect(mockSocketFactory.mockSocket.sentCommands).toContainEqual({
        command: 'fetch',
        resultSetHandle: 17,
        startPosition: 1,
        numBytes: 42,
      });
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

  describe('importFromParquetFile', () => {
    // [utest->dsn~runtime-parquet-import-file-readability-check~1]
    it('should fail due to closed connection', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;
      await driver.close();

      await expect(driver.importFromParquetFile('targetTable', '/tmp/missing')).rejects.toThrow('E-EDJS-2: Connection was closed.');
    });

    it('should fail due to missing file', async () => {
      const connectPromise = driver.connect();
      mockSocketFactory.mockSocket.simulateOpen();
      await connectPromise;

      await expect(driver.importFromParquetFile('targetTable', '/tmp/missing')).rejects.toThrow("E-EDJS-14: Import file not found: '/tmp/missing'. Verify the file path exists and is readable.");
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
