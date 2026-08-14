import { newSocketClosedError, newSocketError } from './errors';

describe('errors (Browser)', () => {
  describe('newSocketError in a browser runtime', () => {
    it('preserves the non-enumerable message from an ErrorEvent', () => {
      const errorEvent = new ErrorEvent('error', { message: 'WebSocket connection failed' });

      expect(newSocketError(errorEvent).message).toBe(
        "E-EDJS-16: Socket error: 'WebSocket connection failed'",
      );
    });
  });

  // [utest->dsn~runtime-inflight-websocket-failure~1]
  describe('newSocketClosedError in a browser runtime', () => {
    it('preserves close event details', () => {
      const closeEvent = new CloseEvent('close', { code: 1006, reason: 'connection lost' });

      expect(newSocketClosedError(closeEvent).message).toBe(
        "E-EDJS-36: Socket closed: code '1006', reason 'connection lost'.",
      );
    });
  });
});
