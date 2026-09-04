import { ExasolDriver, ExasolPool } from './browser';
import { createMockWebsocketFactory } from './lib/mock-socket';

describe('browser entry point', () => {
  // [utest->dsn~decision-publish-cjs-and-esm~2]
  it('constructs a driver with an explicit WebSocket factory', () => {
    const driver = new ExasolDriver(createMockWebsocketFactory().factory, { accessToken: 'access-token' });

    expect(driver).toBeInstanceOf(ExasolDriver);
    expect('importFromCsvFile' in driver).toBe(false);
    expect('exportToCsvFile' in driver).toBe(false);
  });

  it('constructs a pool with an explicit WebSocket factory', () => {
    const pool = new ExasolPool(createMockWebsocketFactory().factory, { accessToken: 'access-token' });

    expect(pool).toBeInstanceOf(ExasolPool);
  });
});
