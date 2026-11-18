import { NodeRSA } from 'node-rsa';
import { encryptPassword } from './login-encryption';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('encryptPassword', () => {
  it('encrypts a non-ASCII password with PKCS#1 v1.5 using Exasol key components', () => {
    const keyPair = new NodeRSA({ b: 2048 });
    const publicKey = keyPair.exportKey('components-public');
    const exponent = typeof publicKey.e === 'number' ? publicKey.e.toString(16) : toHex(publicKey.e);
    const password = 'pässwörd🔒';

    const encrypted = encryptPassword(password, toHex(publicKey.n), exponent);

    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    keyPair.setOptions({ encryptionScheme: 'pkcs1' });
    expect(keyPair.decrypt(encrypted, 'utf8')).toBe(password);
  });
});
