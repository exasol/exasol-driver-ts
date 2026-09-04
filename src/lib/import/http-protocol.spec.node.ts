import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { HttpRequest, parseByteRange, readHttpRequest, receiveHttpRequestBody, sendChunkedResponse, serveFileRequests } from './http-protocol';

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

  describe('serveFileRequests', () => {
    // [utest->dsn~runtime-parquet-import-file-stream~1]
    it('responds to sequential HEAD and byte-range GET requests before returning the SQL result', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'exasol-driver-ts-http-'));
      const filePath = join(directory, 'source.parquet');
      await writeFile(filePath, 'abcdef');
      const socket = new FakeSocket();
      let resolveSql: (rowCount: number) => void;
      const sqlPromise = new Promise<number>((resolve) => {
        resolveSql = resolve;
      });

      try {
        const serving = serveFileRequests(socket as never, filePath, sqlPromise, { rangeRequests: true });
        await waitFor(() => socket.listenerCount('data') > 0);
        socket.emit('data', Buffer.from('HEAD /001.parquet HTTP/1.1\r\n\r\n'));
        await waitFor(() => socket.written.length > 0);
        await nextTurn();
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\nRange: bytes=2-4\r\n\r\n'));
        await waitFor(() => socket.written.length > 1);
        resolveSql!(3);

        await expect(serving).resolves.toBe(3);
        expect(socket.written.join('')).toContain('HTTP/1.1 200 OK\r\nAccept-Ranges: bytes\r\nContent-Length: 6\r\n\r\n');
        expect(socket.written.join('')).toContain('HTTP/1.1 206 Partial Content\r\nAccept-Ranges: bytes\r\nContent-Range: bytes 2-4/6\r\nContent-Length: 3\r\n\r\ncde');
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it('responds to suffix byte-range GET requests with the requested trailing bytes', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'exasol-driver-ts-http-'));
      const filePath = join(directory, 'source.parquet');
      await writeFile(filePath, 'abcdef');
      const socket = new FakeSocket();
      let resolveSql: (rowCount: number) => void;
      const sqlPromise = new Promise<number>((resolve) => {
        resolveSql = resolve;
      });

      try {
        const serving = serveFileRequests(socket as never, filePath, sqlPromise, { rangeRequests: true });
        await waitFor(() => socket.listenerCount('data') > 0);
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\nRange: bytes=-3\r\n\r\n'));
        await waitFor(() => socket.written.length > 1);

        expect(socket.written.join('')).toContain('HTTP/1.1 206 Partial Content\r\nAccept-Ranges: bytes\r\nContent-Range: bytes 3-5/6\r\nContent-Length: 3\r\n\r\ndef');

        await nextTurn();
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\nRange: bytes=-6\r\n\r\n'));
        await waitFor(() => socket.written.length > 3);
        await nextTurn();
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\nRange: bytes=-10\r\n\r\n'));
        await waitFor(() => socket.written.length > 5);
        resolveSql!(3);

        await expect(serving).resolves.toBe(3);
        expect(socket.written.join('')).toContain('Content-Range: bytes 0-5/6\r\nContent-Length: 6\r\n\r\nabcdef');
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it('retains explicit, open-ended, malformed, and unsatisfiable byte-range handling', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'exasol-driver-ts-http-'));
      const filePath = join(directory, 'source.parquet');
      await writeFile(filePath, 'abcdef');
      const socket = new FakeSocket();
      let resolveSql: (rowCount: number) => void;
      const sqlPromise = new Promise<number>((resolve) => {
        resolveSql = resolve;
      });

      try {
        const serving = serveFileRequests(socket as never, filePath, sqlPromise, { rangeRequests: true });
        await waitFor(() => socket.listenerCount('data') > 0);
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\nRange: bytes=2-10\r\n\r\n'));
        await waitFor(() => socket.written.length > 1);
        await nextTurn();
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\nRange: bytes=4-\r\n\r\n'));
        await waitFor(() => socket.written.length > 3);
        await nextTurn();
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\nRange: bytes=invalid\r\n\r\n'));
        await waitFor(() => socket.written.length > 5);
        await nextTurn();
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\nRange: bytes=6-7\r\n\r\n'));
        await waitFor(() => socket.written.length > 6);
        resolveSql!(3);

        await expect(serving).resolves.toBe(3);
        expect(socket.written.join('')).toContain('Content-Range: bytes 2-5/6\r\nContent-Length: 4\r\n\r\ncdef');
        expect(socket.written.join('')).toContain('Content-Range: bytes 4-5/6\r\nContent-Length: 2\r\n\r\nef');
        expect(socket.written.join('')).toContain('HTTP/1.1 200 OK\r\nAccept-Ranges: bytes\r\nContent-Length: 6\r\n\r\nabcdef');
        expect(socket.written.join('')).toContain('HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */6\r\nContent-Length: 0\r\n\r\n');
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it('rejects and destroys the file stream when a backpressured tunnel closes', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'exasol-driver-ts-http-'));
      const filePath = join(directory, 'source.parquet');
      await writeFile(filePath, 'abcdef');
      const socket = new FakeSocket(false);
      let fileStream: import('node:fs').ReadStream | undefined;

      try {
        const serving = serveFileRequests(socket as never, filePath, new Promise<number>(() => undefined), {
          rangeRequests: true,
          onFileStream: (stream) => {
            fileStream = stream;
          },
        });
        await waitFor(() => socket.listenerCount('data') > 0);
        socket.emit('data', Buffer.from('GET /001.parquet HTTP/1.1\r\n\r\n'));
        await waitFor(() => socket.written.some((write) => write === 'abcdef'));
        socket.emit('close');

        await expect(serving).rejects.toThrow('Tunnel socket closed while sending file response.');
        expect(fileStream?.destroyed).toBe(true);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  });

  describe('parseByteRange', () => {
    it.each([
      ['an explicit range', 'Range: bytes=2-4\r\n', { start: 2, end: 4 }],
      ['an explicit range with a clamped end', 'Range: bytes=2-10\r\n', { start: 2, end: 5 }],
      ['an open-ended range', 'Range: bytes=4-\r\n', { start: 4, end: 5 }],
      ['a suffix range', 'Range: bytes=-3\r\n', { start: 3, end: 5 }],
      ['a suffix range equal to the file size', 'Range: bytes=-6\r\n', { start: 0, end: 5 }],
      ['a suffix range larger than the file size', 'Range: bytes=-10\r\n', { start: 0, end: 5 }],
      ['a malformed range', 'Range: bytes=invalid\r\n', undefined],
      ['an empty range', 'Range: bytes=\r\n', undefined],
      ['an minus range', 'Range: bytes=-\r\n', null],
      ['an missing range header', '', undefined],
      ['an unsatisfiable explicit range', 'Range: bytes=6-7\r\n', null],
      ['an unsatisfiable suffix range', 'Range: bytes=-0\r\n', null],
    ])('parses %s', (_description, rangeHeader, expectedRange) => {
      expect(parseByteRange(`GET /001.parquet HTTP/1.1\r\n${rangeHeader}\r\n`, 6)).toEqual(expectedRange);
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

class FakeSocket extends EventEmitter {
  public readonly written: string[] = [];

  public constructor(private readonly writeResult = true) {
    super();
  }

  public pause(): this {
    return this;
  }

  public resume(): this {
    return this;
  }

  public write(data: string | Buffer): boolean {
    this.written.push(data.toString());
    return this.writeResult;
  }
}

function nextTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function waitFor(condition: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1_000;
  while (Date.now() < timeoutAt) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  if (condition()) {
    return;
  }

  throw new Error('Condition did not become true.');
}
