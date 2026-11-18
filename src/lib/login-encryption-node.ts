import { constants, createPublicKey, publicEncrypt } from 'node:crypto';

function hexToBase64Url(hex: string): string {
  const padded = hex.length % 2 === 0 ? hex : `0${hex}`;
  if (!/^[0-9a-f]+$/i.test(padded)) {
    throw new Error('Invalid RSA public key component.');
  }
  return Buffer.from(padded, 'hex').toString('base64url');
}

// [impl->dsn~runtime-node-password-encryption~1]
export function encryptPasswordNode(password: string, modulus: string, exponent: string): string {
  const key = createPublicKey({
    key: { kty: 'RSA', n: hexToBase64Url(modulus), e: hexToBase64Url(exponent) },
    format: 'jwk',
  });
  return publicEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(password, 'utf8')).toString('base64');
}
