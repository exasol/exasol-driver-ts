import { Readable } from 'node:stream';
import { decodeChunkedHttpBody } from './chunked-http-body';

// [utest->dsn~runtime-csv-export-chunked-request-stream~1]
describe('decodeChunkedHttpBody', () => {
  it('decodes fragmented chunks and ignores chunk extensions', async () => {
    const chunks = Readable.from([Buffer.from('llo\r\n6;extension=value\r\n world\r\n0\r\n'), Buffer.from('\r\n')]);

    await expect(readContent(chunks, Buffer.from('5\r\nhe'))).resolves.toEqual(Buffer.from('hello world'));
  });

  it('streams payload fragments before receiving the complete chunk', async () => {
    const chunks = new Readable({ read() {} });
    const body = decodeChunkedHttpBody(chunks, Buffer.from('a\r\n'));
    const firstChunk = body.next();

    chunks.push('first');

    await expect(firstChunk).resolves.toEqual({ value: Buffer.from('first'), done: false });

    const secondChunk = body.next();
    chunks.push(' part\r\n0\r\n\r\n');

    await expect(secondChunk).resolves.toEqual({ value: Buffer.from(' part'), done: false });
    await expect(body.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('accepts trailers after the terminating chunk', async () => {
    const chunks = Readable.from([Buffer.from('0\r\nChecksum: abc\r\n\r\n')]);

    await expect(readBody(chunks, Buffer.alloc(0))).resolves.toEqual([]);
  });

  it('rejects an invalid chunk size', async () => {
    await expect(readBody(Readable.from([]), Buffer.from('invalid\r\n'))).rejects.toThrow(
      "E-EDJS-33: Malformed chunked HTTP request body: invalid chunk size 'invalid'.",
    );
  });

  it('rejects a missing chunk terminator', async () => {
    await expect(readBody(Readable.from([]), Buffer.from('3\r\nabcxx'))).rejects.toThrow(
      'E-EDJS-32: Malformed chunked HTTP request body: missing chunk terminator.',
    );
  });

  it('rejects an incomplete body', async () => {
    await expect(readBody(Readable.from([]), Buffer.from('5\r\nabc'))).rejects.toThrow(
      'E-EDJS-34: Socket closed before receiving complete chunked HTTP request body.',
    );
  });

  it('rejects incomplete trailers', async () => {
    await expect(readBody(Readable.from([]), Buffer.from('0\r\nTrailer: value\r\n'))).rejects.toThrow(
      'E-EDJS-35: Socket closed before receiving complete chunked HTTP request trailers.',
    );
  });
});

async function readBody(chunks: AsyncIterable<Buffer>, initialBody: Buffer): Promise<Buffer[]> {
  const body: Buffer[] = [];
  for await (const chunk of decodeChunkedHttpBody(chunks, initialBody)) {
    body.push(chunk);
  }
  return body;
}

async function readContent(chunks: AsyncIterable<Buffer>, initialBody: Buffer): Promise<Buffer> {
  return Buffer.concat(await readBody(chunks, initialBody));
}
