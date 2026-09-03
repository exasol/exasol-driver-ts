import { ExaWebsocket } from './connection';
import { createBrowserWebsocketFactory, ExasolDriver } from './sql-client';

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
});
