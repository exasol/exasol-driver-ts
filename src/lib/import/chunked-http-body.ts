import { ExaErrorBuilder } from '../errors/error-reporting';

/** Decodes the payload bytes of an HTTP request with `Transfer-Encoding: chunked`. */
export async function* decodeChunkedHttpBody(
  chunks: AsyncIterable<Buffer | Uint8Array | string>,
  initialBody: Buffer,
): AsyncGenerator<Buffer> {
  yield* new ChunkedHttpBodyDecoder(chunks[Symbol.asyncIterator](), initialBody).decode();
}

class ChunkedHttpBodyDecoder {
  private remainingPayloadLength: number | undefined;

  constructor(
    private readonly iterator: AsyncIterator<Buffer | Uint8Array | string>,
    private buffer: Buffer,
  ) { }

  async *decode(): AsyncGenerator<Buffer> {
    while (true) {
      await this.readChunkHeader();

      if (this.remainingPayloadLength === 0) {
        await this.consumeFinalTrailers();
        return;
      }

      yield* this.yieldAvailablePayload();

      if (this.remainingPayloadLength !== undefined && this.remainingPayloadLength > 0) {
        await this.appendNextChunk(incompleteChunkedBodyError());
        continue;
      }

      await this.consumePayloadTerminator();
      this.remainingPayloadLength = undefined;
    }
  }

  private async readChunkHeader(): Promise<void> {
    if (this.remainingPayloadLength !== undefined) {
      return;
    }

    while (true) {
      const chunkLength = readChunkLength(this.buffer);
      if (chunkLength !== undefined) {
        this.remainingPayloadLength = chunkLength.size;
        this.buffer = this.buffer.subarray(chunkLength.headerLength);
        return;
      }
      await this.appendNextChunk(incompleteChunkedBodyError());
    }
  }

  private *yieldAvailablePayload(): Generator<Buffer> {
    const dataLength = Math.min(this.buffer.length, this.remainingPayloadLength ?? 0);
    if (dataLength === 0) {
      return;
    }

    yield this.buffer.subarray(0, dataLength);
    this.buffer = this.buffer.subarray(dataLength);
    this.remainingPayloadLength! -= dataLength;
  }

  private async consumePayloadTerminator(): Promise<void> {
    await this.ensureBuffered(2, incompleteChunkedBodyError());
    if (this.buffer.subarray(0, 2).toString() !== '\r\n') {
      throw new ExaErrorBuilder('E-EDJS-32').message('Malformed chunked HTTP request body: missing chunk terminator.').error();
    }
    this.buffer = this.buffer.subarray(2);
  }

  private async consumeFinalTrailers(): Promise<void> {
    while (!hasCompleteTrailers(this.buffer)) {
      await this.appendNextChunk(incompleteChunkedTrailersError());
    }
  }

  private async ensureBuffered(length: number, error: Error): Promise<void> {
    while (this.buffer.length < length) {
      await this.appendNextChunk(error);
    }
  }

  private async appendNextChunk(error: Error): Promise<void> {
    const next = await this.iterator.next();
    if (next.done) {
      throw error;
    }
    this.buffer = Buffer.concat([this.buffer, Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value)]);
  }
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
  return buffer.subarray(0, 2).toString() === '\r\n' || buffer.includes('\r\n\r\n');
}

function incompleteChunkedBodyError(): Error {
  return new ExaErrorBuilder('E-EDJS-34').message('Socket closed before receiving complete chunked HTTP request body.').error();
}

function incompleteChunkedTrailersError(): Error {
  return new ExaErrorBuilder('E-EDJS-35').message('Socket closed before receiving complete chunked HTTP request trailers.').error();
}
