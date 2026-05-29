import * as net from 'node:net';
import { createTunnel, parseResponse } from './http-transport';

jest.mock('node:net');

describe('http-transport', () => {
  describe('parseResponse', () => {
    it('should parse the internal host and port from the handshake response', () => {
      const response = Buffer.alloc(24);
      response.writeInt32LE(8564, 4);
      response.write('internal-host', 8, 'utf-8');

      expect(parseResponse(response)).toEqual({ host: 'internal-host', port: 8564 });
    });

    it('should trim trailing null bytes from the internal host', () => {
      const response = Buffer.alloc(24);
      response.writeInt32LE(443, 4);
      response.write('db-node', 8, 'utf-8');

      expect(parseResponse(response)).toEqual({ host: 'db-node', port: 443 });
    });

    it('should support UTF-8 characters in host name', () => {
      const response = Buffer.alloc(24);
      response.writeInt32LE(443, 4);
      response.write('dbäöüß', 8, 'utf-8');

      expect(parseResponse(response)).toEqual({ host: 'dbäöüß', port: 443 });
    });

    it('should trim too long host names', () => {
      const response = Buffer.alloc(24);
      response.writeInt32LE(443, 4);
      response.write('very-long-host-name-that-exceeds-limit', 8, 'utf-8');

      expect(parseResponse(response)).toEqual({ host: 'very-long-host-n', port: 443 });
    });
  });

  describe('createTunnel', () => {
    it('should reject with descriptive error and close socket on connection error', async () => {
      const mockSocket = {
        on: jest.fn(),
        once: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      } as unknown as net.Socket;

      (net.createConnection as jest.Mock).mockReturnValue(mockSocket);

      const tunnelPromise = createTunnel('192.168.1.10', 8563);

      const errorHandler = (mockSocket.on as jest.Mock).mock.calls.find((call: [string, () => void]) => call[0] === 'error');
      expect(errorHandler).toBeDefined();

      errorHandler[1](new Error('ECONNREFUSED'));

      await expect(tunnelPromise).rejects.toThrow("E-EDJS-12: Failed to establish tunnel connection to Exasol at '192.168.1.10':'8563': 'ECONNREFUSED'.");
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should reject with E-EDJS-15 and destroy socket on incomplete handshake response', async () => {
      const mockSocket = {
        on: jest.fn(),
        once: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      } as unknown as net.Socket;

      (net.createConnection as jest.Mock).mockReturnValue(mockSocket);

      const tunnelPromise = createTunnel('192.168.1.10', 8563);

      const dataHandler = (mockSocket.once as jest.Mock).mock.calls.find((call: [string, () => void]) => call[0] === 'data');
      expect(dataHandler).toBeDefined();

      dataHandler[1](Buffer.alloc(10));

      await expect(tunnelPromise).rejects.toThrow("E-EDJS-15: Incomplete handshake response from Exasol. Expected '24' bytes, got '10'.");
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });
});
