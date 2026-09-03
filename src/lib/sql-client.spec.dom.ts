import { ExaWebsocket } from './connection';
import { createMockWebsocketFactory } from './mock-socket';
import { createBrowserWebsocketFactory, ExasolDriver } from './sql-client';
import { ExasolPool } from './sql-pool';

// [utest->dsn~runtime-reject-missing-credentials~1]
describe('sqlClient', () => {
  // [utest->dsn~runtime-browser-websocket~2]
  it('configures the browser WebSocket factory to receive binary messages as ArrayBuffers', () => {
    const socket = createBrowserWebsocketFactory()('ws://localhost');

    expect(socket.binaryType).toBe('arraybuffer');
    socket.close();
  });

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

  describe('with no global WebSocket', () => {
    let webSocketDescriptor: PropertyDescriptor | undefined;

    beforeEach(() => {
      webSocketDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
      Reflect.deleteProperty(globalThis, 'WebSocket');
    });

    afterEach(() => {
      if (webSocketDescriptor) {
        Object.defineProperty(globalThis, 'WebSocket', webSocketDescriptor);
      }
    });

    it('allows an explicit WebSocket factory', () => {
      expect(() => new ExasolDriver(createMockWebsocketFactory().factory, {})).not.toThrow();
    });

    it('allows an explicit WebSocket factory for the pool', async () => {
      const pool = new ExasolPool(createMockWebsocketFactory().factory, {});
      expect(pool).toBeInstanceOf(ExasolPool);

      await pool.drain();
      await pool.clear();
    });
  });
});
