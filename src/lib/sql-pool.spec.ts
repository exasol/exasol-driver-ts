import { NodeExasolPool as ExasolPool } from './node-sql-pool';
import { createMockWebsocketFactory } from './mock-socket';

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
});
