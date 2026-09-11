import { deflate, inflate } from 'pako';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
import { CloseResultSetCommand } from './commands';
import { WebsocketProtocol } from './websocket-protocol';

describe('websocket protocol', () => {
  const command = new CloseResultSetCommand([17]);

  beforeAll(() => {
    if (!globalThis.TextEncoder) {
      Object.defineProperty(globalThis, 'TextEncoder', { value: NodeTextEncoder });
    }
    if (!globalThis.TextDecoder) {
      Object.defineProperty(globalThis, 'TextDecoder', { value: NodeTextDecoder });
    }
  });

  it('sends an uncompressed command', () => {
    const send = jest.fn();

    const protocol = new WebsocketProtocol({ send });

    protocol.sendCommand(command);

    expect(send).toHaveBeenCalledWith('{"command":"closeResultSet","resultSetHandles":[17]}');
  });

  it('sends a compressed command', () => {
    const send = jest.fn();

    const protocol = new WebsocketProtocol({ send });
    protocol.setCompression(true);

    protocol.sendCommand(command);

    const sentData = send.mock.calls[0][0];
    expect(sentData).toBeInstanceOf(Uint8Array);
    if (!(sentData instanceof Uint8Array)) {
      throw new Error('Expected a compressed command payload.');
    }
    expect(new TextDecoder().decode(new Uint8Array(inflate(sentData)))).toBe('{"command":"closeResultSet","resultSetHandles":[17]}');
  });

  it('parses an uncompressed response', () => {
    const response = { status: 'ok', responseData: { result: 1 } };

    const protocol = new WebsocketProtocol({ send: jest.fn() });

    expect(protocol.parseResponse(JSON.stringify(response))).toEqual(response);
  });

  it('parses a compressed response', () => {
    const response = { status: 'error', responseData: { result: 1 } };
    const compressed = deflate(new TextEncoder().encode(JSON.stringify(response)));

    const protocol = new WebsocketProtocol({ send: jest.fn() });
    protocol.setCompression(true);

    expect(protocol.parseResponse(compressed)).toEqual(response);
  });

  it('rejects a response that is not text', () => {
    const protocol = new WebsocketProtocol({ send: jest.fn() });

    expect(() => protocol.parseResponse(new Uint8Array())).toThrow('WebSocket response is not text: received object.');
  });

  it('rejects invalid response JSON', () => {
    const protocol = new WebsocketProtocol({ send: jest.fn() });

    expect(() => protocol.parseResponse('{not JSON}')).toThrow(SyntaxError);
  });

  it('rejects a response with an invalid status', () => {
    const protocol = new WebsocketProtocol({ send: jest.fn() });

    expect(() => protocol.parseResponse('{"status":"pending"}')).toThrow("WebSocket response has an invalid status: received 'pending'.");
  });

  it.each([
    ['a null response', 'null', 'undefined'],
    ['a primitive response', '1', 'undefined'],
    ['a response without status', '{}', 'undefined'],
  ])('rejects %s', (_description, data, status) => {
    const protocol = new WebsocketProtocol({ send: jest.fn() });

    expect(() => protocol.parseResponse(data)).toThrow(`WebSocket response has an invalid status: received '${status}'.`);
  });
});
