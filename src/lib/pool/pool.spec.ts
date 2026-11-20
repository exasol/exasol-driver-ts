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

  it('should remove only the given connection', async () => {
    const connectionPool = new ConnectionPool<{ name: string }>(1, new Logger());
    const connection = { name: 'test' };
    await connectionPool.add(connection);

    connectionPool.remove({ name: 'test' });
    expect(connectionPool.getAll()).toEqual([connection]);

    connectionPool.remove(connection);
    expect(connectionPool.getAll()).toEqual([]);
  });

  it('should not add a removed connection again on release', async () => {
    const connectionPool = new ConnectionPool<{ name: string }>(1, new Logger());
    await connectionPool.add({ name: 'test' });
    const connection = connectionPool.acquire() as PoolItem;

    connectionPool.remove(connection);
    connectionPool.release(connection);

    expect(connectionPool.getAll()).toEqual([]);
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
