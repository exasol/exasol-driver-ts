/* eslint-disable jest/no-conditional-expect */
import { Logger } from '../logger/logger';
import { ConnectionPool, PoolItem } from './pool';

describe('connectionPool', () => {
  it('should work for single item pool', async () => {
    const connectionPool = new ConnectionPool<{ name: string }>(1, new Logger());
    expect(connectionPool.acquire()).toBeUndefined();
    await connectionPool.add({ name: 'test' });

    const connection = connectionPool.acquire() as PoolItem;
    expect(connection?.name).toEqual('test');
    expect(connectionPool.acquire()).toBeUndefined();
    connectionPool.release(connection);

    const connection2 = connectionPool.acquire();
    expect(connection2?.name).toEqual('test');
  });

  it('should work for multiple items in pool', async () => {
    const connectionPool = new ConnectionPool<{ name: string }>(2, new Logger());
    expect(connectionPool.acquire()).toBeUndefined();
    await connectionPool.add({ name: 'test' });
    await connectionPool.add({ name: 'test2' });

    const connection = connectionPool.acquire();
    expect(connection?.name).toEqual('test');
    const connection2 = connectionPool.acquire();
    expect(connection2?.name).toEqual('test2');
  });
});
