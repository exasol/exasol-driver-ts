import { generateKeyPair, randomBytes, sign } from 'node:crypto';

function der(tag: number, value: Buffer): Buffer {
  const length = value.length;
  if (length < 128) {
    return Buffer.concat([Buffer.from([tag, length]), value]);
  }
  const bytes: number[] = [];
  for (let remaining = length; remaining > 0; remaining >>>= 8) {
    bytes.unshift(remaining & 0xff);
  }
  return Buffer.concat([Buffer.from([tag, 0x80 | bytes.length, ...bytes]), value]);
}

function sequence(...parts: Buffer[]): Buffer {
  return der(0x30, Buffer.concat(parts));
}

function pem(type: string, bytes: Buffer): string {
  return `-----BEGIN ${type}-----\n${bytes.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END ${type}-----\n`;
}

function utcTime(date: Date): Buffer {
  const value = date.toISOString().replace(/[-:T]/g, '').replace(/\.\d{3}Z$/, 'Z').slice(2);
  return der(0x17, Buffer.from(value, 'ascii'));
}

const rsaSha256 = sequence(
  der(0x06, Buffer.from('2a864886f70d01010b', 'hex')),
  der(0x05, Buffer.alloc(0)),
);
const commonName = sequence(der(0x06, Buffer.from('550403', 'hex')), der(0x0c, Buffer.from('exasol-driver-ts')));
const name = sequence(der(0x31, commonName));

/** Create the short-lived self-signed TLS identity used by one local transfer. */
export async function createSelfSignedCertificate(): Promise<{ key: string; cert: string }> {
  const { publicKey, privateKey } = await new Promise<{
    publicKey: import('node:crypto').KeyObject;
    privateKey: import('node:crypto').KeyObject;
  }>((resolve, reject) => {
    generateKeyPair('rsa', { modulusLength: 2048 }, (error, publicKey, privateKey) => {
      if (error) reject(error);
      else resolve({ publicKey, privateKey });
    });
  });
  const serial = randomBytes(16);
  serial[0] = (serial[0] & 0x7f) | 1;
  const now = Date.now();
  const validity = sequence(utcTime(new Date(now - 60_000)), utcTime(new Date(now + 365 * 86_400_000)));
  const subjectPublicKey = publicKey.export({ type: 'spki', format: 'der' });
  const tbs = sequence(
    der(0xa0, der(0x02, Buffer.from([2]))),
    der(0x02, serial),
    rsaSha256,
    name,
    validity,
    name,
    subjectPublicKey,
  );
  const signature = sign('sha256', tbs, privateKey);
  const certificate = sequence(tbs, rsaSha256, der(0x03, Buffer.concat([Buffer.from([0]), signature])));
  return {
    key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    cert: pem('CERTIFICATE', certificate),
  };
}
