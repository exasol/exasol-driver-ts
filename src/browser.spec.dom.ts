import { ExasolDriver, ExasolPool } from './browser';
import { createMockWebsocketFactory } from './lib/mock-socket';

describe('browser entry point', () => {
  // [utest->dsn~decision-publish-cjs-and-esm~2]
  // [utest->dsn~runtime-browser-websocket~2]
  it('constructs a driver with an explicit WebSocket factory and excludes CSV operations', () => {
    const driver = new ExasolDriver(createMockWebsocketFactory().factory, { accessToken: 'access-token' });

    expect('importFromCsvFile' in driver).toBe(false);
    expect('exportToCsvFile' in driver).toBe(false);
  });

  it('constructs a pool with an explicit WebSocket factory', () => {
    const pool = new ExasolPool(createMockWebsocketFactory().factory, { accessToken: 'access-token' });

    expect(pool).toBeInstanceOf(ExasolPool);
  });
});
