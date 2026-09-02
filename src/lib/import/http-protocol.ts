import * as fs from 'node:fs';
import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import * as stream from 'node:stream';
import * as tls from 'node:tls';
import { ExaErrorBuilder } from '../errors/error-reporting';
import { decodeChunkedHttpBody } from './chunked-http-body';

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
      removeListeners(socket, { data: onData, end: onEnd, error: onError });
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

function hasChunkedTransferEncoding(headers: string): boolean {
  const transferEncoding = headers
    .split('\r\n')
    .find((line) => line.toLowerCase().startsWith('transfer-encoding:'))
    ?.slice('transfer-encoding:'.length);
  return transferEncoding?.split(',').some((value) => value.trim().toLowerCase() === 'chunked') ?? false;
}

async function* readRequestBody(socket: net.Socket | tls.TLSSocket, request: HttpRequest): AsyncGenerator<Buffer> {
  // [impl->dsn~runtime-csv-export-chunked-request-stream~1]
  if (hasChunkedTransferEncoding(request.headers)) {
    yield* decodeChunkedHttpBody(socket.iterator({ destroyOnReturn: false }), request.initialBody);
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
      removeListeners(dataStream, { data: onData, end: onEnd, error: onError });
    }

    dataStream.on('data', onData);
    dataStream.on('end', onEnd);
    dataStream.on('error', onError);
  });
}

function removeListeners(emitter: EventEmitter, listeners: Record<string, Parameters<EventEmitter['removeListener']>[1]>): void {
  for (const [event, listener] of Object.entries(listeners)) {
    emitter.removeListener(event, listener);
  }
}

export interface FileServingOptions {
  rangeRequests?: boolean;
  onFileStream?: (fileStream: fs.ReadStream) => void;
}

/** Serves a local file until Exasol completes the import query. */
export async function serveFileRequests(
  socket: net.Socket | tls.TLSSocket,
  filePath: string,
  sqlPromise: Promise<number>,
  options: FileServingOptions = {},
): Promise<number> {
  const fileSize = options.rangeRequests ? (await fs.promises.stat(filePath)).size : undefined;
  const sqlResult = sqlPromise.then((rowCount) => ({ rowCount }));
  let servedRequest = false;

  while (true) {
    let result: { rowCount: number } | { request: HttpRequest };
    try {
      result = await Promise.race([
        sqlResult,
        readHttpRequest(socket).then((request) => ({ request })),
      ]);
    } catch (error) {
      if (servedRequest && error instanceof Error && error.message.startsWith('E-EDJS-13:')) {
        return sqlPromise;
      }
      throw error;
    }
    if ('rowCount' in result) {
      return result.rowCount;
    }
    await sendFileResponse(socket, filePath, result.request, fileSize, options);
    servedRequest = true;
    socket.resume();
  }
}

async function sendFileResponse(
  socket: net.Socket | tls.TLSSocket,
  filePath: string,
  request: HttpRequest,
  fileSize: number | undefined,
  options: FileServingOptions,
): Promise<void> {
  if (!options.rangeRequests) {
    const fileStream = fs.createReadStream(filePath);
    options.onFileStream?.(fileStream);
    await sendChunkedResponse(socket, fileStream);
    return;
  }
  if (fileSize === undefined) {
    throw new Error('File size is required for range requests.');
  }
  const method = request.headers.split('\r\n', 1)[0]?.split(' ', 1)[0];
  const range = parseByteRange(request.headers, fileSize);
  if (range === null) {
    socket.write(`HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */${fileSize}\r\nContent-Length: 0\r\n\r\n`);
    return;
  }

  const { start, end } = range ?? { start: 0, end: fileSize - 1 };
  const contentLength = end - start + 1;
  const status = range === undefined ? '200 OK' : '206 Partial Content';
  const contentRange = range === undefined ? '' : `Content-Range: bytes ${start}-${end}/${fileSize}\r\n`;
  socket.write(`HTTP/1.1 ${status}\r\nAccept-Ranges: bytes\r\n${contentRange}Content-Length: ${contentLength}\r\n\r\n`);

  if (method === 'HEAD') {
    return;
  }
  const fileStream = fs.createReadStream(filePath, { start, end });
  options.onFileStream?.(fileStream);
  await writeReadable(socket, fileStream);
}

function parseByteRange(headers: string, fileSize: number): { start: number; end: number } | undefined | null {
  const value = /^range:\s*bytes=(\d*)-(\d*)\s*$/im.exec(headers);
  if (!value) {
    return undefined;
  }
  const [, startText, endText] = value;
  if (startText === '' && endText === '') {
    return null;
  }
  const start = startText === '' ? Math.max(0, fileSize - Number(endText)) : Number(startText);
  const end = endText === '' ? fileSize - 1 : Math.min(Number(endText), fileSize - 1);
  return start >= fileSize || start > end ? null : { start, end };
}

function writeReadable(socket: net.Socket | tls.TLSSocket, dataStream: stream.Readable): Promise<void> {
  return new Promise((resolve, reject) => {
    function onData(chunk: Buffer) {
      if (!socket.write(chunk)) {
        dataStream.pause();
        socket.once('drain', dataStream.resume.bind(dataStream));
      }
    }
    function onEnd() {
      cleanup();
      resolve();
    }
    function onError(error: Error) {
      cleanup();
      reject(error);
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
