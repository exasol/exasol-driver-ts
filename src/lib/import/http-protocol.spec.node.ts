import { PassThrough } from 'stream';
import { readHttpRequest, sendChunkedResponse } from './http-protocol';

describe('http-protocol', () => {
  describe('readHttpRequest', () => {
    it('should return full HTTP request when headers arrive in a single chunk', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.push('GET /001.csv HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');

      const result = await requestPromise;
      expect(result).toBe('GET /001.csv HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');
    });

    it('should accumulate data arriving in multiple chunks', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.push('GET /001.csv HTTP/1.1\r\n');
      socket.push('Host: 127.0.0.1\r\n');
      socket.push('\r\n');

      const result = await requestPromise;
      expect(result).toBe('GET /001.csv HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');
    });

    it('should reject with E-EDJS-13 if socket emits error', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.destroy(new Error('connection reset'));

      await expect(requestPromise).rejects.toThrow('E-EDJS-13');
    });

    it('should reject with E-EDJS-13 if socket closes before headers are complete', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.push('GET /001.csv HTTP/1.1\r\n');
      socket.push(null);

      await expect(requestPromise).rejects.toThrow('E-EDJS-13');
    });
  });

  describe('sendChunkedResponse', () => {
    it('should write HTTP response headers followed by chunked data and terminating chunk', async () => {
      const socket = new PassThrough();
      const dataStream = new PassThrough();
      const written: string[] = [];

      socket.on('data', (chunk: Buffer) => {
        written.push(chunk.toString());
      });

      const responsePromise = sendChunkedResponse(socket as never, dataStream);

      dataStream.push('hello');
      dataStream.push(null);

      await responsePromise;

      const output = written.join('');
      expect(output).toContain('HTTP/1.1 200 OK\r\n');
      expect(output).toContain('Transfer-Encoding: chunked\r\n');
      expect(output).toContain('5\r\nhello\r\n');
      expect(output).toContain('0\r\n\r\n');
    });

    it('should handle multiple data chunks with correct hex lengths', async () => {
      const socket = new PassThrough();
      const dataStream = new PassThrough();
      const written: string[] = [];

      socket.on('data', (chunk: Buffer) => {
        written.push(chunk.toString());
      });

      const responsePromise = sendChunkedResponse(socket as never, dataStream);

      dataStream.push('abc');
      dataStream.push('defghijklmnop');
      dataStream.push(null);

      await responsePromise;

      const output = written.join('');
      expect(output).toContain('3\r\nabc\r\n');
      expect(output).toContain('d\r\ndefghijklmnop\r\n');
    });

    it('should send zero-length terminating chunk after stream ends', async () => {
      const socket = new PassThrough();
      const dataStream = new PassThrough();
      const written: string[] = [];

      socket.on('data', (chunk: Buffer) => {
        written.push(chunk.toString());
      });

      const responsePromise = sendChunkedResponse(socket as never, dataStream);

      dataStream.push(null);

      await responsePromise;

      const output = written.join('');
      expect(output).toContain('0\r\n\r\n');
    });

    it('should reject with E-EDJS-13 if data stream emits error', async () => {
      const socket = new PassThrough();
      const dataStream = new PassThrough();

      const responsePromise = sendChunkedResponse(socket as never, dataStream);

      dataStream.destroy(new Error('read error'));

      await expect(responsePromise).rejects.toThrow('E-EDJS-13');
    });
  });
});
