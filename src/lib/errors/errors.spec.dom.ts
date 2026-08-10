import { newSocketError } from './errors';

describe('newSocketError in a browser runtime', () => {
  it('preserves the non-enumerable message from an ErrorEvent', () => {
    const errorEvent = new ErrorEvent('error', { message: 'WebSocket connection failed' });

    expect(newSocketError(errorEvent).message).toBe(
      "E-EDJS-13: Socket error: 'WebSocket connection failed'",
    );
  });
});
