import { Pool } from 'generic-pool';
import { ExasolPool, rejectNextWaitingClient } from './exasol-pool';
import { ILogger } from './logger/logger';

const createLogger = (): jest.Mocked<ILogger> => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
});
import { createMockWebsocketFactory, MultiHostMockWebsocketFactory } from './mock-socket';

describe('exasolPool', () => {
  // [utest->dsn~runtime-pool-async-disposal~1]
  it('should drain and clear the pool when disposed with await using', async () => {
    const pool = new ExasolPool(createMockWebsocketFactory().factory, { accessToken: 'access-token' });
    const drain = jest.spyOn(pool, 'drain').mockResolvedValue();
    const clear = jest.spyOn(pool, 'clear').mockResolvedValue();

    {
      await using managedPool = pool;
      expect(managedPool).toBe(pool);
    }

    expect(drain.mock.invocationCallOrder[0]).toBeLessThan(clear.mock.invocationCallOrder[0]);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  // [utest->dsn~runtime-pool-create-failure~1]
  describe('when a driver cannot be created', () => {
    it('rejects the query with the connection error instead of retrying', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'error');
      const pool = new ExasolPool(factory.factory, { accessToken: 'access-token', host: 'exasol1' });

      await expect(pool.query('select 1')).rejects.toThrow('E-EDJS-42');
      expect(factory.urls).toEqual(['wss://exasol1:8563']);
    });

    it('rejects every waiting query and tries again for later queries', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'error');
      const pool = new ExasolPool(factory.factory, { accessToken: 'access-token', host: 'exasol1', maximumPoolSize: 1 });

      const results = await Promise.allSettled([pool.query('select 1'), pool.query('select 1')]);
      expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);

      await expect(pool.query('select 1')).rejects.toThrow('E-EDJS-42');
      expect(factory.urls).toHaveLength(3);
    });

    it('rejects a query when the certificate mode is not supported in browsers', async () => {
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      const pool = new ExasolPool(factory.factory, { accessToken: 'access-token', host: 'exasol1/nocertcheck' });

      await expect(pool.query('select 1')).rejects.toThrow('E-EDJS-45');
      expect(factory.urls).toEqual([]);
    });

    it('warns when the internal queue of generic-pool is not available', () => {
      const logger = createLogger();
      const error = new Error('connection failed');

      rejectNextWaitingClient({} as Pool<unknown>, error, logger);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unsupported generic-pool version'), error);
    });

    it('rejects the oldest waiting request of generic-pool', () => {
      const logger = createLogger();
      const error = new Error('connection failed');
      const request = { reject: jest.fn() };
      const pool = { _waitingClientsQueue: { dequeue: () => request } } as unknown as Pool<unknown>;

      rejectNextWaitingClient(pool, error, logger);

      expect(request.reject).toHaveBeenCalledWith(error);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('creates a driver again after a failure', async () => {
      let fail = true;
      const factory = new MultiHostMockWebsocketFactory({}, 'open');
      const pool = new ExasolPool((url, options) => {
        if (fail) {
          throw new Error('unreachable');
        }
        return factory.factory(url, options);
      }, { accessToken: 'access-token', host: 'exasol1' });

      await expect(pool.query('select 1')).rejects.toThrow('E-EDJS-42');
      fail = false;
      await expect(pool.query('select 1')).resolves.toBeDefined();
      await pool.drain();
      await pool.clear();
    });
  });
});
