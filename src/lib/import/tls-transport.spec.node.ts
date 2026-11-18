import { createHash, createPrivateKey, X509Certificate } from 'node:crypto';
import * as tls from 'node:tls';
import { PassThrough } from 'node:stream';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';

// [utest->dsn~runtime-csv-import-file-stream~1]
describe('tls-transport', () => {
  describe('generateAdHocCertificate', () => {
    it('should generate a certificate with a matching key and sha256 public-key fingerprint', async () => {
      const result = await generateAdHocCertificate();
      const certificate = new X509Certificate(result.cert);
      const publicKeyDer = certificate.publicKey.export({ type: 'spki', format: 'der' });

      expect(certificate.checkPrivateKey(createPrivateKey(result.key))).toBe(true);
      expect(certificate.verify(certificate.publicKey)).toBe(true);
      expect(certificate.publicKey.asymmetricKeyDetails?.modulusLength).toBe(2048);
      expect(result.fingerprint).toBe(`sha256//${createHash('sha256').update(publicKeyDer).digest('base64')}`);
      // signatureAlgorithm is available starting with Node.js 24.9.0.
      if (certificate.signatureAlgorithm !== undefined) {
        expect(certificate.signatureAlgorithm).toBe('sha256WithRSAEncryption');
      }
    });

    it('should generate unique certificates on each call', async () => {
      const first = await generateAdHocCertificate();
      const second = await generateAdHocCertificate();

      expect(first.fingerprint).not.toEqual(second.fingerprint);
    });
  });

  describe('wrapWithTls', () => {
    it('should return a TLSSocket instance', async () => {
      const { key, cert } = await generateAdHocCertificate();
      const mockSocket = new PassThrough() as unknown as import('node:net').Socket;

      const tlsSocket = wrapWithTls(mockSocket, key, cert);

      expect(tlsSocket).toBeInstanceOf(tls.TLSSocket);
      tlsSocket.destroy();
    });
  });
});
