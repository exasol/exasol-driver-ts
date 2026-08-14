import { newSocketClosedError, newSocketError } from './errors';

describe('newSocketError', () => {
  it('preserves the message from a Node WebSocket Error', () => {
    expect(newSocketError(new Error('certificate has expired')).message).toBe(
      "E-EDJS-16: Socket error: 'certificate has expired'",
    );
  });

  it('preserves the message from a browser WebSocket ErrorEvent', () => {
    const errorEvent = { message: 'WebSocket connection failed' };

    expect(newSocketError(errorEvent).message).toBe(
      "E-EDJS-16: Socket error: 'WebSocket connection failed'",
    );
  });

  it('serializes causes without a message', () => {
    expect(newSocketError({ code: 'ECONNREFUSED' }).message).toBe(
      "E-EDJS-16: Socket error: '{\"code\":\"ECONNREFUSED\"}'",
    );
  });
});

// [utest->dsn~runtime-inflight-websocket-failure~1]
describe('newSocketClosedError', () => {
  it('preserves the WebSocket close code and reason', () => {
    expect(newSocketClosedError({ code: 1006, reason: 'connection lost' }).message).toBe(
      "E-EDJS-28: Socket closed: code '1006', reason 'connection lost'.",
    );
  });

  it('uses safe fallback details when the close event is incomplete', () => {
    expect(newSocketClosedError({ code: 1006 }).message).toBe(
      "E-EDJS-28: Socket closed: code 'unknown', reason 'not provided'.",
    );
  });
});
