import * as tls from 'tls';
import { PassThrough } from 'stream';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';

describe('tls-transport', () => {
  describe('generateAdHocCertificate', () => {
    it('should generate a certificate with sha256 fingerprint', () => {
      const result = generateAdHocCertificate();

      expect(result.key).toBeDefined();
      expect(result.cert).toBeDefined();
      expect(result.fingerprint).toMatch(/^sha256\/\/.+$/);
    });

    it('should generate unique certificates on each call', () => {
      const first = generateAdHocCertificate();
      const second = generateAdHocCertificate();

      expect(first.fingerprint).not.toEqual(second.fingerprint);
    });
  });

  describe('wrapWithTls', () => {
    it('should return a TLSSocket instance', () => {
      const { key, cert } = generateAdHocCertificate();
      const mockSocket = new PassThrough() as unknown as import('net').Socket;

      const tlsSocket = wrapWithTls(mockSocket, key, cert);

      expect(tlsSocket).toBeInstanceOf(tls.TLSSocket);
      tlsSocket.destroy();
    });
  });
});
