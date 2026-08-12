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
        buffer = await appendNextChunk(iterator, buffer, 'Socket closed before receiving complete chunked HTTP request body.');
        continue;
      }
      chunkSize = chunkLength.size;
      buffer = buffer.subarray(chunkLength.headerLength);
    }

    if (chunkSize === 0) {
      while (!hasCompleteTrailers(buffer)) {
        buffer = await appendNextChunk(iterator, buffer, 'Socket closed before receiving complete chunked HTTP request trailers.');
      }
      return;
    }

    if (buffer.length < chunkSize + 2) {
      buffer = await appendNextChunk(iterator, buffer, 'Socket closed before receiving complete chunked HTTP request body.');
      continue;
    }

    const data = buffer.subarray(0, chunkSize);
    if (buffer.subarray(chunkSize, chunkSize + 2).toString() !== '\r\n') {
      throw new Error('Malformed chunked HTTP request body: missing chunk terminator.');
    }
    buffer = buffer.subarray(chunkSize + 2);
    chunkSize = undefined;
    yield data;
  }
}

async function appendNextChunk(
  iterator: AsyncIterator<Buffer | Uint8Array | string>,
  buffer: Buffer,
  message: string,
): Promise<Buffer> {
  const next = await iterator.next();
  if (next.done) {
    throw new Error(message);
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
    throw new Error('Malformed chunked HTTP request body: invalid chunk size.');
  }
  return { size: Number.parseInt(sizeText, 16), headerLength: lineEnd + 2 };
}

function hasCompleteTrailers(buffer: Buffer): boolean {
  return buffer.subarray(0, 2).toString() === '\r\n' || buffer.indexOf('\r\n\r\n') !== -1;
}
