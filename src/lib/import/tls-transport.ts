import { createHash, X509Certificate } from 'node:crypto';
import * as tls from 'node:tls';
import * as net from 'node:net';
import { createSelfSignedCertificate } from './self-signed-certificate';

// [impl->dsn~runtime-csv-import-file-stream~1]
export interface AdHocCertificate {
  key: string;
  cert: string;
  fingerprint: string;
}

export async function generateAdHocCertificate(): Promise<AdHocCertificate> {
  // [impl->dsn~runtime-node-local-transfer-tls~1]
  const generated = await createSelfSignedCertificate();
  const certificate = new X509Certificate(generated.cert);
  const publicKeyDer = certificate.publicKey.export({ type: 'spki', format: 'der' });
  const fingerprint = `sha256//${createHash('sha256').update(publicKeyDer).digest('base64')}`;
  return { key: generated.key, cert: generated.cert, fingerprint };
}

export function wrapWithTls(socket: net.Socket, key: string, cert: string): tls.TLSSocket {
  return new tls.TLSSocket(socket, {
    isServer: true,
    key,
    cert,
  });
}
