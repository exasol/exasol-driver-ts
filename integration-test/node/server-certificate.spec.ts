import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';
import { ILogger } from '../../src/lib/logger/logger';
import { NodeExasolDriver } from '../../src/lib/node-sql-client';
import { NodeExasolPool } from '../../src/lib/node-sql-pool';
import { Config, WebsocketFactory } from '../../src/lib/sql-client';
import { startNewDockerContainer } from '../exasolContainer';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Server certificate modes with real `ws` WebSockets. The test database uses a certificate from its own CA that does
 * not cover the Testcontainers host, so connecting succeeds only when the CA and host name checks are skipped.
 */
// [itest->dsn~runtime-certificate-mode-selection~1]
// [itest->dsn~runtime-fingerprint-verification~1]
describe('Server certificate', () => {
  jest.setTimeout(7_000_000);

  let host: string;
  let port: number;
  let fingerprint: string;
  const factory: WebsocketFactory = (url, options) =>
    new WebSocket(url, { rejectUnauthorized: options?.rejectUnauthorized ?? true }) as unknown as ExaWebsocket;
  const credentials = { user: 'sys', password: 'exasol' };
  let driver: NodeExasolDriver | undefined;

  beforeAll(async () => {
    const container = await startNewDockerContainer();
    host = container.getHost();
    port = container.getPort();
    fingerprint = await container.getTlsCertificateFingerprint();
  });

  afterEach(async () => {
    await driver?.close();
    driver = undefined;
  });

  const connect = async (config: Partial<Config>, logger?: ILogger) => {
    driver = new NodeExasolDriver(factory, { ...credentials, port, ...config }, logger);
    await driver.connect();
    return driver;
  };

  it('connects when the fingerprint matches the server certificate', async () => {
    const connected = await connect({ host: `${host}/${fingerprint.toLowerCase()}:${port}` });

    await expect(connected.query('SELECT 1')).resolves.toBeDefined();
  });

  it('rejects a different fingerprint', async () => {
    const otherFingerprint = 'AB'.repeat(32);

    await expect(connect({ host: `${host}/${otherFingerprint}:${port}` })).rejects.toThrow(
      `E-EDJS-46: Provided fingerprint '${otherFingerprint}' did not match server fingerprint '${fingerprint}'`,
    );
  });

  // [itest->dsn~runtime-untrusted-certificate-hint~1]
  it('rejects the certificate with the default validation and suggests a fingerprint', async () => {
    // The cause is the Node.js TLS error message, which depends on the certificate chain and the Node.js version.
    const untrustedCertificateError = new RegExp(
      '^' +
        escapeRegExp(`E-EDJS-42: Could not connect to Exasol. Tried '1' host(s): 'wss://${host}:${port}: `) +
        escapeRegExp(`E-EDJS-49: Server certificate of host '${host}' is not trusted: '`) +
        '.+' +
        escapeRegExp(
          "'. Use a server certificate from a trusted certificate authority that covers the host name. " +
            'Alternatively add the SHA-256 fingerprint of the server certificate to the connection string as host/fingerprint, e.g. exasol1/<fingerprint>:8563.\'. ' +
            'Check that the hosts are reachable and the port is correct.',
        ) +
        '$',
    );

    await expect(connect({ host })).rejects.toThrow(untrustedCertificateError);
  });

  // [itest->dsn~runtime-disabled-validation-warning~1]
  it('connects and warns when validateServerCertificate is false', async () => {
    const warn = jest.fn();
    const logger: ILogger = { error: jest.fn(), warn, info: jest.fn(), log: jest.fn(), debug: jest.fn(), trace: jest.fn() };

    const connected = await connect({ host, validateServerCertificate: false }, logger);

    await expect(connected.query('SELECT 1')).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Server certificate validation is disabled'));
  });

  it('connects with the fingerprint nocertcheck', async () => {
    const connected = await connect({ host: `${host}/nocertcheck:${port}` });

    await expect(connected.query('SELECT 1')).resolves.toBeDefined();
  });

  it('connects a pool with a fingerprint', async () => {
    const pool = new NodeExasolPool(factory, { ...credentials, host: `${host}/${fingerprint}:${port}`, port, maximumPoolSize: 1 });
    try {
      await expect(pool.query('SELECT 1')).resolves.toBeDefined();
    } finally {
      await pool.drain();
      await pool.clear();
    }
  });
});
