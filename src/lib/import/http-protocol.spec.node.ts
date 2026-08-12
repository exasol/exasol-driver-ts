import { PassThrough, Writable } from 'node:stream';
import { HttpRequest, readHttpRequest, receiveHttpRequestBody, sendChunkedResponse } from './http-protocol';

// [utest->dsn~runtime-csv-import-file-stream~1]
describe('http-protocol', () => {
  describe('readHttpRequest', () => {
    it('should return full HTTP request when headers arrive in a single chunk', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.push('GET /001.csv HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');

      const result = await requestPromise;
      expect(result).toEqual({
        headers: 'GET /001.csv HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n',
        initialBody: Buffer.alloc(0),
      });
      expect(socket.isPaused()).toBe(true);
    });

    it('should accumulate data arriving in multiple chunks', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.push('GET /001.csv HTTP/1.1\r\n');
      socket.push('Host: 127.0.0.1\r\n');
      socket.push('\r\n');

      const result = await requestPromise;
      expect(result).toEqual({
        headers: 'GET /001.csv HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n',
        initialBody: Buffer.alloc(0),
      });
    });

    it('should retain request body bytes received together with headers', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.push('PUT /001.csv HTTP/1.1\r\nContent-Length: 5\r\n\r\nhello');

      await expect(requestPromise).resolves.toEqual({
        headers: 'PUT /001.csv HTTP/1.1\r\nContent-Length: 5\r\n\r\n',
        initialBody: Buffer.from('hello'),
      });
    });

    it('should reject with E-EDJS-17 if socket emits error', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.destroy(new Error('connection reset'));

      await expect(requestPromise).rejects.toThrow("E-EDJS-17: Failed to read HTTP request from tunnel: 'connection reset'.");
    });

    it('should reject with E-EDJS-13 if socket closes before headers are complete', async () => {
      const socket = new PassThrough();
      const requestPromise = readHttpRequest(socket as never);

      socket.push('GET /001.csv HTTP/1.1\r\n');
      socket.push(null);

      await expect(requestPromise).rejects.toThrow('E-EDJS-13');
    });
  });

  describe('receiveHttpRequestBody', () => {
    // [utest->dsn~runtime-csv-export-chunked-request-stream~1]
    it('should decode fragmented chunked request bodies before writing data', async () => {
      const socket = new PassThrough();
      const { destination, getReceivedBody } = createBodyDestination();
      const request: HttpRequest = {
        headers: 'PUT /001.csv HTTP/1.1\r\nTransfer-Encoding: gzip, Chunked\r\n\r\n',
        initialBody: Buffer.from('5\r\nhe'),
      };

      const bodyPromise = receiveHttpRequestBody(socket as never, request, destination);
      socket.push('llo\r\n6\r\n world\r\n0\r\n');
      socket.push('\r\n');

      await bodyPromise;
      expect(getReceivedBody()).toBe('hello world');
    });

    it('should stream initial and subsequent body bytes until content length is reached', async () => {
      const socket = new PassThrough();
      const { destination, getReceivedBody } = createBodyDestination();
      const request: HttpRequest = {
        headers: 'PUT /001.csv HTTP/1.1\r\nContent-Length: 5\r\n\r\n',
        initialBody: Buffer.from('hel'),
      };

      const bodyPromise = receiveHttpRequestBody(socket as never, request, destination);
      socket.push('lo');

      await bodyPromise;
      expect(getReceivedBody()).toBe('hello');
    });

    it('should resume the socket after receiving a fully buffered body', async () => {
      const socket = new PassThrough();
      const destination = new PassThrough();
      const request: HttpRequest = {
        headers: 'PUT /001.csv HTTP/1.1\r\nContent-Length: 5\r\n\r\n',
        initialBody: Buffer.from('hello'),
      };

      socket.pause();
      await receiveHttpRequestBody(socket as never, request, destination);

      expect(socket.isPaused()).toBe(false);
    });

    it('should stream body bytes until the socket ends when content length is absent', async () => {
      const socket = new PassThrough();
      const { destination, getReceivedBody } = createBodyDestination();
      const request: HttpRequest = {
        headers: 'PUT /001.csv HTTP/1.1\r\n\r\n',
        initialBody: Buffer.from('hel'),
      };

      const bodyPromise = receiveHttpRequestBody(socket as never, request, destination);
      socket.push('lo');
      socket.push(null);

      await bodyPromise;
      expect(getReceivedBody()).toBe('hello');
    });

    it('should reject when the socket closes before the declared content length', async () => {
      const socket = new PassThrough();
      const destination = new PassThrough();
      const request: HttpRequest = {
        headers: 'PUT /001.csv HTTP/1.1\r\nContent-Length: 5\r\n\r\n',
        initialBody: Buffer.from('hel'),
      };

      const bodyPromise = receiveHttpRequestBody(socket as never, request, destination);
      socket.push(null);

      await expect(bodyPromise).rejects.toThrow("E-EDJS-28: Failed to receive HTTP request body from tunnel: 'E-EDJS-29: Socket closed before receiving complete HTTP request body. Expected 2 more bytes.'.");
    });

    it('should reject when the destination fails', async () => {
      const socket = new PassThrough();
      const destination = new Writable({
        write(_chunk, _encoding, callback) {
          callback(new Error('disk full'));
        },
      });
      const request: HttpRequest = {
        headers: 'PUT /001.csv HTTP/1.1\r\nContent-Length: 5\r\n\r\n',
        initialBody: Buffer.from('hello'),
      };

      await expect(receiveHttpRequestBody(socket as never, request, destination)).rejects.toThrow(
        "E-EDJS-28: Failed to receive HTTP request body from tunnel: 'disk full'.",
      );
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

    it('should reject with E-EDJS-18 if data stream emits error', async () => {
      const socket = new PassThrough();
      const dataStream = new PassThrough();

      const responsePromise = sendChunkedResponse(socket as never, dataStream);

      dataStream.destroy(new Error('read error'));

      await expect(responsePromise).rejects.toThrow("E-EDJS-18: Failed to send chunked HTTP response through tunnel: 'read error'.");
    });
  });
});

function createBodyDestination(): { destination: Writable; getReceivedBody: () => string } {
  const received: Buffer[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      received.push(Buffer.from(chunk));
      callback();
    },
  });
  return { destination, getReceivedBody: () => Buffer.concat(received).toString() };
}
