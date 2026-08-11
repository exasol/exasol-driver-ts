import * as net from 'node:net';
import * as stream from 'node:stream';
import * as tls from 'node:tls';
import { ExaErrorBuilder } from '../errors/error-reporting';

// [impl->dsn~runtime-csv-import-file-stream~1]
const HEADER_TERMINATOR = '\r\n\r\n';

export interface HttpRequest {
  headers: string;
  initialBody: Buffer;
}

/**
 * Waits for and reads an HTTP request from Exasol through the tunnel.
 * Returns when headers are fully received and retains body bytes that arrived
 * in the same socket chunk.
 */
export function readHttpRequest(socket: net.Socket | tls.TLSSocket): Promise<HttpRequest> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    function onData(chunk: Buffer) {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf(HEADER_TERMINATOR);
      if (headerEnd !== -1) {
        socket.pause();
        cleanup();
        const bodyStart = headerEnd + HEADER_TERMINATOR.length;
        resolve({
          headers: buffer.subarray(0, bodyStart).toString(),
          initialBody: buffer.subarray(bodyStart),
        });
      }
    }

    function onEnd() {
      cleanup();
      reject(new ExaErrorBuilder('E-EDJS-13').message('Socket closed before receiving complete HTTP request headers.').error());
    }

    function onError(err: Error) {
      cleanup();
      reject(new ExaErrorBuilder('E-EDJS-17').message('Failed to read HTTP request from tunnel: {{reason}}.', err.message).error());
    }

    function cleanup() {
      socket.removeListener('data', onData);
      socket.removeListener('end', onEnd);
      socket.removeListener('error', onError);
    }

    socket.on('data', onData);
    socket.on('end', onEnd);
    socket.on('error', onError);
  });
}

/**
 * Streams an HTTP request body into a writable destination. If the request
 * specifies a content length, the stream ends after exactly that many bytes
 * without waiting for the tunnel connection to close.
 */
export async function receiveHttpRequestBody(
  socket: net.Socket | tls.TLSSocket,
  request: HttpRequest,
  destination: stream.Writable,
): Promise<void> {
  try {
    await stream.promises.pipeline(stream.Readable.from(readRequestBody(socket, request)), destination);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ExaErrorBuilder('E-EDJS-28').message('Failed to receive HTTP request body from tunnel: {{reason}}.', reason).error();
  } finally {
    socket.resume();
  }
}

async function* readRequestBody(socket: net.Socket | tls.TLSSocket, request: HttpRequest): AsyncGenerator<Buffer> {
  if (hasChunkedTransferEncoding(request.headers)) {
    yield* readChunkedRequestBody(socket, request.initialBody);
    return;
  }

  let remaining = getContentLength(request.headers);

  if (request.initialBody.length > 0) {
    const initialBody = takeBodyBytes(request.initialBody, remaining);
    yield initialBody.bytes;
    remaining = initialBody.remaining;
  }

  if (remaining === 0) {
    return;
  }

  const bodyIterator = socket.iterator({ destroyOnReturn: false });
  for await (const chunk of bodyIterator) {
    const body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const nextBody = takeBodyBytes(body, remaining);
    yield nextBody.bytes;
    remaining = nextBody.remaining;
    if (remaining === 0) {
      return;
    }
  }

  if (remaining !== undefined) {
    throw new ExaErrorBuilder('E-EDJS-29')
      .message(`Socket closed before receiving complete HTTP request body. Expected ${remaining} more bytes.`)
      .error();
  }
}

/**
 * Decodes an HTTP/1.1 chunked message body. The terminating zero-size chunk
 * marks the end of the body, so a persistent tunnel connection need not close.
 */
async function* readChunkedRequestBody(socket: net.Socket | tls.TLSSocket, initialBody: Buffer): AsyncGenerator<Buffer> {
  let buffered = initialBody;
  let state: 'size' | 'data' | 'data-terminator' | 'trailers' = 'size';
  let chunkSize = 0;

  const bodyIterator = socket.iterator({ destroyOnReturn: false });
  while (true) {
    if (state === 'size') {
      const lineEnd = buffered.indexOf('\r\n');
      if (lineEnd !== -1) {
        const sizeLine = buffered.subarray(0, lineEnd).toString('ascii');
        const match = /^([0-9A-Fa-f]+)(?:;[^\r\n]*)?$/.exec(sizeLine);
        if (match === null) {
          throw new Error(`Invalid HTTP chunk size: '${sizeLine}'.`);
        }
        chunkSize = Number.parseInt(match[1], 16);
        if (!Number.isSafeInteger(chunkSize)) {
          throw new Error(`HTTP chunk size exceeds the supported range: '${sizeLine}'.`);
        }
        buffered = buffered.subarray(lineEnd + 2);
        state = chunkSize === 0 ? 'trailers' : 'data';
        continue;
      }
    } else if (state === 'data') {
      if (buffered.length >= chunkSize) {
        yield buffered.subarray(0, chunkSize);
        buffered = buffered.subarray(chunkSize);
        state = 'data-terminator';
        continue;
      }
    } else if (state === 'data-terminator') {
      if (buffered.length >= 2) {
        if (buffered[0] !== 13 || buffered[1] !== 10) {
          throw new Error('HTTP chunk data is not followed by a CRLF delimiter.');
        }
        buffered = buffered.subarray(2);
        state = 'size';
        continue;
      }
    } else {
      const lineEnd = buffered.indexOf('\r\n');
      if (lineEnd !== -1) {
        buffered = buffered.subarray(lineEnd + 2);
        if (lineEnd === 0) {
          return;
        }
        continue;
      }
    }

    const next = await bodyIterator.next();
    if (next.done) {
      throw new Error('Socket closed before receiving the complete chunked HTTP request body.');
    }
    buffered = Buffer.concat([buffered, Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value)]);
  }
}

function hasChunkedTransferEncoding(headers: string): boolean {
  const transferEncoding = /^transfer-encoding:\s*(.+?)\s*$/im.exec(headers)?.[1];
  return transferEncoding?.split(',').some((encoding) => encoding.trim().toLowerCase() === 'chunked') ?? false;
}

function getContentLength(headers: string): number | undefined {
  const contentLength = /^content-length:\s*(\d+)\s*$/im.exec(headers)?.[1];
  return contentLength === undefined ? undefined : Number(contentLength);
}

function takeBodyBytes(bytes: Buffer, remaining: number | undefined): { bytes: Buffer; remaining: number | undefined } {
  if (remaining === undefined) {
    return { bytes, remaining };
  }
  if (bytes.length > remaining) {
    throw new Error(`Received more HTTP request body bytes than declared by Content-Length (${remaining}).`);
  }
  return { bytes, remaining: remaining - bytes.length };
}

/**
 * Sends data as a chunked HTTP response through the tunnel.
 * Writes HTTP response headers, then pipes the readable stream as chunks,
 * then sends the terminating zero-length chunk.
 */
export function sendChunkedResponse(socket: net.Socket | tls.TLSSocket, dataStream: stream.Readable): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n');

    function onData(chunk: Buffer) {
      const hexLength = chunk.length.toString(16);
      socket.write(hexLength + '\r\n');
      socket.write(chunk);
      const flushed = socket.write('\r\n');
      if (!flushed) {
        dataStream.pause();
        socket.once('drain', () => {
          dataStream.resume();
        });
      }
    }

    function onEnd() {
      socket.write('0\r\n\r\n', () => {
        cleanup();
        resolve();
      });
    }

    function onError(err: Error) {
      cleanup();
      reject(
        new ExaErrorBuilder('E-EDJS-18').message('Failed to send chunked HTTP response through tunnel: {{reason}}.', err.message).error(),
      );
    }

    function cleanup() {
      dataStream.removeListener('data', onData);
      dataStream.removeListener('end', onEnd);
      dataStream.removeListener('error', onError);
    }

    dataStream.on('data', onData);
    dataStream.on('end', onEnd);
    dataStream.on('error', onError);
  });
}
