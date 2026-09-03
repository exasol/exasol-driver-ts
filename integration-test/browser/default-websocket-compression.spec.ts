import { ExasolDriver } from '../../src/browser';
import { ExasolContainer, startNewDockerContainer } from '../exasolContainer';

// [itest->dsn~runtime-browser-websocket~2]
describe('browser default WebSocket factory', () => {
  let container: ExasolContainer;

  jest.setTimeout(7000000);

  beforeAll(async () => {
    container = await startNewDockerContainer();
  });

  it.each([false, true])('connects and queries with compression %s', async (compression) => {
    const driver = new ExasolDriver({
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
