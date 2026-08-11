import { once } from 'node:events';
import * as net from 'node:net';
import { PassThrough } from 'node:stream';
import { readHttpRequest, receiveHttpRequestBody, sendChunkedResponse } from '../../src/lib/import/http-protocol';

// [itest->dsn~runtime-csv-import-file-stream~1]
describe('HTTP tunnel protocol', () => {
  it('reads request headers and body bytes over a TCP socket', async () => {
    let resolveRequest!: () => void;
    let rejectRequest!: (error: unknown) => void;
    const requestReceived = new Promise<void>((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });
    const server = await startServer((socket) => {
      void readHttpRequest(socket)
        .then((request) => {
          expect(request.headers).toBe('PUT /001.csv HTTP/1.1\r\nContent-Length: 5\r\n\r\n');
          expect(request.initialBody).toEqual(Buffer.from('hello'));
          socket.end();
          resolveRequest();
        })
        .catch(rejectRequest);
    });

    try {
      const client = await connect(server.port);
      client.end('PUT /001.csv HTTP/1.1\r\nContent-Length: 5\r\n\r\nhello');

      await requestReceived;
      await once(client, 'close');
    } finally {
      await closeServer(server);
    }
  });

  it('streams an HTTP request body received over TCP into a writable destination', async () => {
    let resolveTransfer!: () => void;
    let rejectTransfer!: (error: unknown) => void;
    const transferCompleted = new Promise<void>((resolve, reject) => {
      resolveTransfer = resolve;
      rejectTransfer = reject;
    });
    const server = await startServer((socket) => {
      void (async () => {
        const request = await readHttpRequest(socket);
        const destination = new PassThrough();
        const received: Buffer[] = [];
        destination.on('data', (chunk: Buffer) => received.push(chunk));

        await receiveHttpRequestBody(socket, request, destination);

        expect(Buffer.concat(received).toString()).toBe('hello world');
        socket.end('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
        resolveTransfer();
      })().catch(rejectTransfer);
    });

    try {
      const client = await connect(server.port);
      client.write('PUT /001.csv HTTP/1.1\r\nContent-Length: 11\r\n\r\nhello');
      client.end(' world');

      await transferCompleted;
      const response = await readSocket(client);
      expect(response).toBe('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
    } finally {
      await closeServer(server);
    }
  });

  it('sends a chunked HTTP response over TCP', async () => {
    let resolveResponse!: () => void;
    let rejectResponse!: (error: unknown) => void;
    const responseSent = new Promise<void>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    const server = await startServer((socket) => {
      void (async () => {
        await readHttpRequest(socket);
        const source = new PassThrough();
        const sendResponse = sendChunkedResponse(socket, source);
        source.end('hello');

        await sendResponse;
        socket.end();
        resolveResponse();
      })().catch(rejectResponse);
    });

    try {
      const client = await connect(server.port);
      client.end('GET /001.csv HTTP/1.1\r\nHost: localhost\r\n\r\n');

      const response = await readSocket(client);
      await responseSent;
      expect(response).toBe('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n0\r\n\r\n');
    } finally {
      await closeServer(server);
    }
  });
});

async function startServer(handler: (socket: net.Socket) => void): Promise<net.Server & { port: number }> {
  const server = net.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected TCP server address.');
  }
  return Object.assign(server, { port: address.port });
}

async function connect(port: number): Promise<net.Socket> {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  await once(socket, 'connect');
  return socket;
}

async function readSocket(socket: net.Socket): Promise<string> {
  const chunks: Buffer[] = [];
  socket.on('data', (chunk: Buffer) => chunks.push(chunk));
  await once(socket, 'end');
  return Buffer.concat(chunks).toString();
}

async function closeServer(server: net.Server): Promise<void> {
  server.close();
  await once(server, 'close');
}
