import { ExaWebsocket } from './connection';
import { ExasolDriver } from './sql-client';

// [utest->dsn~runtime-reject-missing-credentials~1]
describe('sqlClient', () => {
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
