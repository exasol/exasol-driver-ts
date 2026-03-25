import * as net from 'net';
import { ExaErrorBuilder } from '../errors/error-reporting';
import { InternalAddress } from './types';

const MAGIC_PACKET_SIZE = 12;
const RESPONSE_SIZE = 24;
const MAGIC_VALUE = 0x02212102;
const PROTOCOL_VERSION = 1;
const HOST_OFFSET = 8;
const HOST_LENGTH = 16;
const PORT_OFFSET = 4;

function buildMagicPacket(): Buffer {
  const buffer = Buffer.alloc(MAGIC_PACKET_SIZE);
  buffer.writeInt32LE(MAGIC_VALUE, 0);
  buffer.writeInt32LE(PROTOCOL_VERSION, 4);
  buffer.writeInt32LE(PROTOCOL_VERSION, 8);
  return buffer;
}

function parseResponse(data: Buffer): InternalAddress {
  const port = data.readInt32LE(PORT_OFFSET);
  const hostBytes = data.slice(HOST_OFFSET, HOST_OFFSET + HOST_LENGTH);
  const host = hostBytes.toString('utf-8').replace(/\0+$/, '');
  return { host, port };
}

export function createTunnel(host: string, port: number): Promise<{ socket: net.Socket; internalAddress: InternalAddress }> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(buildMagicPacket());
    });

    socket.once('data', (data: Buffer) => {
      if (data.length < RESPONSE_SIZE) {
        socket.destroy();
        reject(
          new ExaErrorBuilder('E-EDJS-15')
            .message('Incomplete handshake response from Exasol. Expected {{expected}} bytes, got {{actual}}.', RESPONSE_SIZE, data.length)
            .error(),
        );
        return;
      }
      const internalAddress = parseResponse(data);
      resolve({ socket, internalAddress });
    });

    socket.on('error', (err: Error) => {
      socket.destroy();
      reject(
        new ExaErrorBuilder('E-EDJS-12')
          .message('Failed to establish tunnel connection to Exasol at {{host}}:{{port}}: {{reason}}.', host, port, err.message)
          .error(),
      );
    });
  });
}
