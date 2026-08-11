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
