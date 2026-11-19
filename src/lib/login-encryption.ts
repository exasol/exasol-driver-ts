import { NodeRSA } from 'node-rsa';

function hexToBytes(hex: string): Uint8Array {
  const padded = hex.length % 2 === 0 ? hex : `0${hex}`;
  if (!/^[0-9a-f]+$/i.test(padded)) {
    throw new Error('Invalid RSA public key component.');
  }
  return Uint8Array.from(padded.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

export function encryptPasswordBrowser(password: string, modulus: string, exponent: string): string {
  const key = new NodeRSA(undefined, { encryptionScheme: 'pkcs1' });
  key.importKey({ n: hexToBytes(modulus), e: hexToBytes(exponent) }, 'components-public');
  return key.encrypt(password, 'base64');
}
