import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';
import { ExasolDriver, WebsocketFactory } from '../../src/lib/sql-client';
import { ExasolPool } from '../../src/lib/sql-pool';
import { startNewDockerContainer } from '../exasolContainer';

// [itest->dsn~runtime-inflight-websocket-failure~1]
describe('Connection lifecycle', () => {
  jest.setTimeout(7000000);

  let ca: string | undefined;
  let factory: WebsocketFactory;
  let driver: ExasolDriver;
  let websocket: WebSocket | undefined;
  let commandSent: Promise<void>;
  let resolveCommandSent: (() => void) | undefined;
  let host: string;
  let port: number;

  beforeAll(async () => {
    const container = await startNewDockerContainer();
    ca = await container.loadCA();
    host = container.getHost();
    port = container.getPort();
    factory = (url) => {
      websocket = new WebSocket(url, { rejectUnauthorized: true, ca, checkServerIdentity: () => false });
      const send = websocket.send.bind(websocket);
      websocket.send = ((...args: Parameters<WebSocket['send']>) => {
        const command = JSON.parse(args[0].toString()) as { command?: string; sqlText?: string };
        if (command.command === 'execute' && command.sqlText === 'SELECT "$SLEEP"(5)') {
          resolveCommandSent?.();
        }
        return send(...args);
      }) as WebSocket['send'];
      return websocket as ExaWebsocket;
    };
  });

  beforeEach(async () => {
    commandSent = new Promise<void>((resolve) => {
      resolveCommandSent = resolve;
    });
    driver = new ExasolDriver(factory, { host, port, user: 'sys', password: 'exasol' });
    await driver.connect();
  });

  afterEach(async () => {
    await driver.close();
  });

  it('rejects an in-flight command when the WebSocket closes', async () => {
    const query = driver.query('SELECT "$SLEEP"(5)');
    await commandSent;
    websocket?.terminate();

    const outcome = await Promise.race([
      query.then(
        () => 'resolved',
        () => 'rejected',
      ),
      new Promise<'timed out'>((resolve) => setTimeout(() => resolve('timed out'), 1000)),
    ]);

    expect(outcome).toBe('rejected');
  });

  it('replaces a pooled driver whose WebSocket closes during a command', async () => {
    const pool = new ExasolPool(factory, {
      host,
      port,
      user: 'sys',
      password: 'exasol',
      minimumPoolSize: 0,
      maximumPoolSize: 1,
    });

    try {
      const query = pool.query('SELECT "$SLEEP"(5)');
      await commandSent;
      websocket?.terminate();

      await expect(query).rejects.toThrow('E-EDJS-28: Socket closed:');

      const result = await pool.query('SELECT 1');
      expect(result.getRows()).toHaveLength(1);
    } finally {
      await pool.drain();
      await pool.clear();
    }
  });
});
