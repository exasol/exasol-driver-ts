import * as tls from 'node:tls';
import * as net from 'node:net';
import * as crypto from 'node:crypto';
import { PassThrough } from 'node:stream';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';

// [utest->dsn~runtime-csv-import-file-stream~1]
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

    it('should emit PEM-encoded key and certificate', () => {
      const result = generateAdHocCertificate();

      expect(result.key).toContain('-----BEGIN PRIVATE KEY-----');
      expect(result.cert).toContain('-----BEGIN CERTIFICATE-----');
    });
  });

  describe('wrapWithTls', () => {
    it('should return a TLSSocket instance', () => {
      const { key, cert } = generateAdHocCertificate();
      const mockSocket = new PassThrough() as unknown as net.Socket;

      const tlsSocket = wrapWithTls(mockSocket, key, cert);

      expect(tlsSocket).toBeInstanceOf(tls.TLSSocket);
      tlsSocket.destroy();
    });
  });

  describe('TLS round-trip', () => {
    it('should complete a handshake and pin the public key matching the fingerprint', async () => {
      const { key, cert, fingerprint } = generateAdHocCertificate();

      // The hand-built cert must be structurally valid for the server side to
      // load it; the handshake must complete; and the peer certificate's SPKI
      // sha256 base64 must equal the pinned fingerprint.
      const server = tls.createServer({ key, cert });

      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', resolve);
        });

        const address = server.address() as net.AddressInfo;

        const peerCert = await new Promise<tls.PeerCertificate>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('handshake timed out')), 5000);

          const client = tls.connect(
            { host: '127.0.0.1', port: address.port, rejectUnauthorized: false },
            () => {
              clearTimeout(timer);
              const detailedCert = client.getPeerCertificate(true);
              client.destroy();
              resolve(detailedCert);
            },
          );
          client.once('error', (err) => {
            clearTimeout(timer);
            client.destroy();
            reject(err);
          });
        });

        expect(peerCert).toBeDefined();
        expect(peerCert.pubkey).toBeDefined();

        // Re-import the peer's public key as SPKI DER and hash it, comparing
        // against the fingerprint we pin in the IMPORT SQL.
        const peerPubkeyDer = peerCert.pubkey as Buffer;
        const peerPublicKey = crypto.createPublicKey({ key: peerPubkeyDer, format: 'der', type: 'spki' });
        const peerSpkiDer = peerPublicKey.export({ type: 'spki', format: 'der' });
        const peerHash = crypto.createHash('sha256').update(peerSpkiDer).digest('base64');

        expect(`sha256//${peerHash}`).toEqual(fingerprint);
        expect(fingerprint.replace('sha256//', '')).toEqual(peerHash);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
