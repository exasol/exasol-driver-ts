import { ExaErrorBuilder } from '../errors/error-reporting';

/** Decodes the payload bytes of an HTTP request with `Transfer-Encoding: chunked`. */
export async function* decodeChunkedHttpBody(
  chunks: AsyncIterable<Buffer | Uint8Array | string>,
  initialBody: Buffer,
): AsyncGenerator<Buffer> {
  let buffer = initialBody;
  const iterator = chunks[Symbol.asyncIterator]();
  let chunkSize: number | undefined;

  while (true) {
    if (chunkSize === undefined) {
      const chunkLength = readChunkLength(buffer);
      if (chunkLength === undefined) {
        buffer = await appendNextChunk(iterator, buffer, incompleteChunkedBodyError());
        continue;
      }
      chunkSize = chunkLength.size;
      buffer = buffer.subarray(chunkLength.headerLength);
    }

    if (chunkSize === 0) {
      while (!hasCompleteTrailers(buffer)) {
        buffer = await appendNextChunk(iterator, buffer, incompleteChunkedTrailersError());
      }
      return;
    }

    if (buffer.length < chunkSize + 2) {
      buffer = await appendNextChunk(iterator, buffer, incompleteChunkedBodyError());
      continue;
    }

    const data = buffer.subarray(0, chunkSize);
    if (buffer.subarray(chunkSize, chunkSize + 2).toString() !== '\r\n') {
      throw new ExaErrorBuilder('E-EDJS-32').message('Malformed chunked HTTP request body: missing chunk terminator.').error();
    }
    buffer = buffer.subarray(chunkSize + 2);
    chunkSize = undefined;
    yield data;
  }
}

async function appendNextChunk(
  iterator: AsyncIterator<Buffer | Uint8Array | string>,
  buffer: Buffer,
  error: Error,
): Promise<Buffer> {
  const next = await iterator.next();
  if (next.done) {
    throw error;
  }
  return Buffer.concat([buffer, Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value)]);
}

function readChunkLength(buffer: Buffer): { size: number; headerLength: number } | undefined {
  const lineEnd = buffer.indexOf('\r\n');
  if (lineEnd === -1) {
    return undefined;
  }
  const sizeText = buffer.subarray(0, lineEnd).toString().split(';', 1)[0];
  if (!/^[0-9a-f]+$/i.test(sizeText)) {
    throw new ExaErrorBuilder('E-EDJS-33').message('Malformed chunked HTTP request body: invalid chunk size {{sizeText}}.', sizeText).error();
  }
  return { size: Number.parseInt(sizeText, 16), headerLength: lineEnd + 2 };
}

function hasCompleteTrailers(buffer: Buffer): boolean {
  return buffer.subarray(0, 2).toString() === '\r\n' || buffer.indexOf('\r\n\r\n') !== -1;
}

function incompleteChunkedBodyError(): Error {
  return new ExaErrorBuilder('E-EDJS-34').message('Socket closed before receiving complete chunked HTTP request body.').error();
}

function incompleteChunkedTrailersError(): Error {
  return new ExaErrorBuilder('E-EDJS-35').message('Socket closed before receiving complete chunked HTTP request trailers.').error();
}
