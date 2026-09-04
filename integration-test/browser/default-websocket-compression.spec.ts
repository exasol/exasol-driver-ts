import { ExasolDriver } from '../../src/browser';
import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { ExasolContainer, startNewDockerContainer } from '../exasolContainer';

describe('browser WebSocket factory', () => {
  let container: ExasolContainer;

  jest.setTimeout(7000000);

  beforeAll(async () => {
    container = await startNewDockerContainer();
  });

  it.each([false, true])('connects and queries with compression %s', async (compression) => {
    const driver = new ExasolDriver(createWebsocketFactoryNoCert(), {
      host: container.getHost(),
      port: container.getPort(),
      user: 'sys',
      password: 'exasol',
      compression,
    });

    try {
      await driver.connect();

      const result = await driver.query("SELECT 'browser-default-websocket' AS RESULT_VALUE");

      expect(result.getRows()).toHaveLength(1);
      expect(result.getRows()[0]['RESULT_VALUE']).toBe('browser-default-websocket');
    } finally {
      await driver.close();
    }
  });
});
