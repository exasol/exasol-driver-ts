import * as net from 'net';
import { createTunnel } from './http-transport';

jest.mock('net');

describe('http-transport', () => {
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

      await expect(tunnelPromise).rejects.toThrow('E-EDJS-12');
      await expect(tunnelPromise).rejects.toThrow('ECONNREFUSED');
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

      await expect(tunnelPromise).rejects.toThrow('E-EDJS-15');
      await expect(tunnelPromise).rejects.toThrow("Expected '24' bytes, got '10'");
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });
});
