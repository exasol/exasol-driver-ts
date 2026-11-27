import { ExaWebsocket } from './connection';
import { MultiHostMockWebsocketFactory } from './mock-socket';
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

// [utest->dsn~runtime-browser-certificate-modes~1]
describe('server certificate in browsers', () => {
  it.each([
    ['a fingerprint', { host: `exasol1/${'ab'.repeat(32)}` }],
    ['fingerprint nocertcheck', { host: 'exasol1/nocertcheck' }],
    ['validateServerCertificate false', { host: 'exasol1', validateServerCertificate: false }],
  ])('rejects %s before opening a WebSocket', async (_description, config) => {
    const factory = new MultiHostMockWebsocketFactory({}, 'open');
    const driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', ...config });

    await expect(driver.connect()).rejects.toThrow(
      'E-EDJS-45: Certificate fingerprints and disabled server certificate validation are not supported in browsers.',
    );
    expect(factory.urls).toEqual([]);
  });

  // [utest->dsn~runtime-untrusted-certificate-hint~1]
  it('does not suggest a fingerprint for an untrusted certificate', async () => {
    const factory = new MultiHostMockWebsocketFactory({}, 'untrusted-certificate');
    const driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1' });

    await expect(driver.connect()).rejects.toThrow(
      "E-EDJS-42: Could not connect to Exasol. Tried '1' host(s): 'wss://exasol1:8563: E-EDJS-16: Socket error: 'self-signed certificate''.",
    );
  });

  it('connects with certificate validation', async () => {
    const factory = new MultiHostMockWebsocketFactory({}, 'open');
    const driver = new ExasolDriver(factory.factory, { accessToken: 'access-token', host: 'exasol1' });

    await driver.connect();

    expect(factory.options).toEqual([{ rejectUnauthorized: true }]);
  });
});
