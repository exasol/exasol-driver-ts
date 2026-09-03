import { ExasolDriver, ExasolPool } from './browser';

describe('browser entry point', () => {
  // [utest->dsn~decision-publish-cjs-and-esm~2]
  it('constructs a driver with the browser default WebSocket factory', () => {
    const driver = new ExasolDriver({ accessToken: 'access-token' });

    expect(driver).toBeInstanceOf(ExasolDriver);
    expect('importFromCsvFile' in driver).toBe(false);
    expect('exportToCsvFile' in driver).toBe(false);
  });

  it('constructs a pool with the browser default WebSocket factory', () => {
    const pool = new ExasolPool({ accessToken: 'access-token' });

    expect(pool).toBeInstanceOf(ExasolPool);
  });
});
