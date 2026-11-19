import { generateKeyPairSync, constants, privateDecrypt } from 'node:crypto';
import { encryptPasswordNode } from './login-encryption-node';

// [utest->dsn~runtime-node-password-encryption~1]
describe('encryptPasswordNode', () => {
  it('encrypts a UTF-8 password with Exasol RSA components and PKCS#1 v1.5 padding', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' });
    const password = 'pässwörd🔒';
    const ciphertext = Buffer.from(encryptPasswordNode(
      password,
      Buffer.from(jwk.n!, 'base64url').toString('hex'),
      Buffer.from(jwk.e!, 'base64url').toString('hex'),
    ), 'base64');

    // Node 22+ disallows PKCS#1 v1.5 privateDecrypt; inspect the RSA block after raw decryption.
    const block = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, ciphertext);
    expect(block[0]).toBe(0);
    expect(block[1]).toBe(2);
    const separator = block.indexOf(0, 2);
    expect(separator).toBeGreaterThanOrEqual(10);
    expect(block.subarray(separator + 1).toString('utf8')).toBe(password);
  });
});
