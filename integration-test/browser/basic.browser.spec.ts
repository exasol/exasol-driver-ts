import { ExasolDriver } from '@exasol/exasol-driver-ts/browser';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { basicTests } from '../testcases/basic.spec';
import { basicAuthConfig, connectionSettings, nativeWebSocketFactory } from './browser-test-support';
import { createBrowserRuntime } from './test-runtime';

// [itest->dsn~runtime-browser-websocket~2]
// [itest->dsn~decision-use-vitest-browser-mode~1]
vi.setConfig({ testTimeout: 7_000_000 });
basicTests(createBrowserRuntime());

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
});
