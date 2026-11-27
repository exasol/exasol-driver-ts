import { ExasolDriver } from '@exasol/exasol-driver-ts/browser';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { basicTests } from '../testcases/basic.spec';
import { basicCompressionTests } from '../testcases/compression.basic.spec';
import { connectionStringTests } from '../testcases/connection-string.spec';
import { basicPoolTests } from '../testcases/pool.basic.spec';
import { resourceManagementTests } from '../testcases/resource-management.spec';
import { basicAuthConfig, connectionSettings, nativeWebSocketFactory } from './browser-test-support';
import { createBrowserRuntime } from './test-runtime';

// [itest->dsn~runtime-browser-websocket~2]
// [itest->dsn~decision-use-vitest-browser-mode~1]
vi.setConfig({ testTimeout: 7_000_000 });
basicTests(createBrowserRuntime());
basicPoolTests(createBrowserRuntime());
basicCompressionTests(createBrowserRuntime());
resourceManagementTests(createBrowserRuntime());
connectionStringTests(createBrowserRuntime());

describe('Browser native WebSocket integration', () => {
  const connection = connectionSettings();
  const nativeWebSocket = nativeWebSocketFactory();
  let driver: ExasolDriver | undefined;

  afterEach(async () => {
    await driver?.close().catch(() => undefined);
    driver = undefined;
  });

  test('uses the native WebSocket factory with the default wss URL', async () => {
    driver = new ExasolDriver(nativeWebSocket.factory, basicAuthConfig(connection));
    await driver.connect();
    expect(nativeWebSocket.urls).toEqual([`wss://${connection.host}:${connection.port}`]);
  });

  // [itest->dsn~runtime-browser-certificate-modes~1]
  test.each([
    ['a fingerprint', (host: string) => ({ host: `${host}/${'ab'.repeat(32)}` })],
    ['validateServerCertificate false', (host: string) => ({ host, validateServerCertificate: false })],
  ])('rejects %s without opening a WebSocket', async (_description, certificateConfig) => {
    const webSocket = nativeWebSocketFactory();
    driver = new ExasolDriver(webSocket.factory, { ...basicAuthConfig(connection), ...certificateConfig(connection.host) });
    await expect(driver.connect()).rejects.toThrow(
      'E-EDJS-45: Certificate fingerprints and disabled server certificate validation are not supported in browsers. ' +
        'Remove the fingerprint from the connection string and do not set validateServerCertificate to false. ' +
        'Use a server certificate that the browser trusts.',
    );
    expect(webSocket.urls).toEqual([]);
  });
});
