import forge from 'node-forge';
import { X509Certificate } from 'node:crypto';
import { createServer, Server } from 'node:https';
import { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { ExaWebsocket } from './connection';
import { generateAdHocCertificate } from './import/tls-transport';
import { normalizeFingerprint } from './node-certificate-check';
import { NodeExasolDriver } from './node-sql-client';
import { WebsocketFactory } from './sql-client';

/** Exercises the fingerprint check with real `ws` WebSockets against a local server with a self-signed certificate. */
describe('server certificate check with ws', () => {
  let server: Server;
  let webSocketServer: WebSocketServer;
  let port: number;
  let fingerprint: string;
  let receivedMessages: string[];

  const wsFactory: WebsocketFactory = (url, options) =>
    new WebSocket(url, { rejectUnauthorized: options?.rejectUnauthorized ?? true }) as unknown as ExaWebsocket;

  const createDriver = (host: string, config: { validateServerCertificate?: boolean } = {}) =>
    new NodeExasolDriver(wsFactory, { host, user: 'sys', password: 'exasol', connectTimeout: 1000, ...config });

  beforeAll(async () => {
    const { key, cert } = generateAdHocCertificate();
    const certPem = forge.pki.certificateToPem(cert);
    fingerprint = normalizeFingerprint(new X509Certificate(certPem).fingerprint256);
    server = createServer({ key: forge.pki.privateKeyToPem(key), cert: certPem });
    webSocketServer = new WebSocketServer({ server });
    webSocketServer.on('connection', (socket) => {
      socket.on('message', (data: Buffer) => receivedMessages.push(data.toString()));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  }, 30_000);

  beforeEach(() => {
    receivedMessages = [];
  });

  afterAll(async () => {
    webSocketServer.clients.forEach((client) => client.terminate());
    await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const waitForMessages = async () => new Promise((resolve) => setTimeout(resolve, 100));

  // [utest->dsn~runtime-fingerprint-verification~1]
  it('sends the login to a server whose certificate matches the fingerprint', async () => {
    const driver = createDriver(`127.0.0.1/${fingerprint.toLowerCase()}:${port}`);

    // The test server never answers the login.
    await expect(driver.connect()).rejects.toThrow('E-EDJS-44: Login timed out');

    expect(receivedMessages).toHaveLength(1);
    expect(JSON.parse(receivedMessages[0])).toMatchObject({ command: 'login' });
  });

  // [utest->dsn~runtime-fingerprint-verification~1]
  it('does not send data to a server with a different certificate', async () => {
    const otherFingerprint = 'AB'.repeat(32);
    const driver = createDriver(`127.0.0.1/${otherFingerprint}:${port}`);

    await expect(driver.connect()).rejects.toThrow(
      `E-EDJS-46: Provided fingerprint '${otherFingerprint}' did not match server fingerprint '${fingerprint}' of host '127.0.0.1'.`,
    );
    await waitForMessages();
    expect(receivedMessages).toEqual([]);
  });

  // [utest->dsn~runtime-certificate-mode-selection~1]
  // [utest->dsn~runtime-untrusted-certificate-hint~1]
  it('rejects a self-signed certificate by default with a hint to the fingerprint', async () => {
    const driver = createDriver(`127.0.0.1:${port}`);

    await expect(driver.connect()).rejects.toThrow(
      `E-EDJS-42: Could not connect to Exasol. Tried '1' host(s): 'wss://127.0.0.1:${port}: ` +
        "E-EDJS-49: Server certificate of host '127.0.0.1' is not trusted: 'self-signed certificate'. " +
        'Use a server certificate from a trusted certificate authority that covers the host name. ' +
        'Alternatively add the SHA-256 fingerprint of the server certificate to the connection string as host/fingerprint, e.g. exasol1/<fingerprint>:8563.\'. ' +
        'Check that the hosts are reachable and the port is correct.',
    );
    expect(receivedMessages).toEqual([]);
  });

  // [utest->dsn~runtime-certificate-mode-selection~1]
  it.each([
    ['validateServerCertificate is false', `127.0.0.1`, { validateServerCertificate: false }],
    ['the fingerprint is nocertcheck', `127.0.0.1/nocertcheck`, {}],
  ])('accepts a self-signed certificate when %s', async (_description, host, config) => {
    const driver = createDriver(`${host}:${port}`, config);

    await expect(driver.connect()).rejects.toThrow('E-EDJS-44: Login timed out');

    expect(receivedMessages).toHaveLength(1);
  });
});
