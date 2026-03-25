import * as net from 'net';
import * as tls from 'tls';
import * as stream from 'stream';
import { ExaErrorBuilder } from '../errors/error-reporting';

const HEADER_TERMINATOR = '\r\n\r\n';

/**
 * Waits for and reads the HTTP GET request from Exasol through the tunnel.
 * Returns when headers are fully received (reads until \r\n\r\n).
 */
export function readHttpRequest(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';

    function onData(chunk: Buffer) {
      buffer += chunk.toString();
      if (buffer.indexOf(HEADER_TERMINATOR) !== -1) {
        cleanup();
        resolve(buffer);
      }
    }

    function onEnd() {
      cleanup();
      reject(new ExaErrorBuilder('E-EDJS-13').message('Socket closed before receiving complete HTTP request headers.').error());
    }

    function onError(err: Error) {
      cleanup();
      reject(new ExaErrorBuilder('E-EDJS-13').message('Failed to read HTTP request from tunnel: {{reason}}.', err.message).error());
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
        new ExaErrorBuilder('E-EDJS-13').message('Failed to send chunked HTTP response through tunnel: {{reason}}.', err.message).error(),
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
