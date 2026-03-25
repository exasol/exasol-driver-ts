import * as forge from 'node-forge';
import * as tls from 'tls';
import * as net from 'net';

export interface AdHocCertificate {
  key: forge.pki.rsa.PrivateKey;
  cert: forge.pki.Certificate;
  fingerprint: string;
}

export function generateAdHocCertificate(): AdHocCertificate {
  const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();

  cert.publicKey = keyPair.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);

  const attrs = [{ name: 'commonName', value: 'exasol-driver-ts' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keyPair.privateKey, forge.md.sha256.create());

  const fingerprint = computeFingerprint(keyPair.publicKey);

  return { key: keyPair.privateKey, cert, fingerprint };
}

function computeFingerprint(publicKey: forge.pki.rsa.PublicKey): string {
  const derBytes = forge.asn1.toDer(forge.pki.publicKeyToAsn1(publicKey)).getBytes();
  const digest = forge.md.sha256.create();
  digest.update(derBytes);
  const base64Hash = forge.util.encode64(digest.digest().getBytes());
  return `sha256//${base64Hash}`;
}

export function wrapWithTls(socket: net.Socket, key: forge.pki.rsa.PrivateKey, cert: forge.pki.Certificate): tls.TLSSocket {
  const keyPem = forge.pki.privateKeyToPem(key);
  const certPem = forge.pki.certificateToPem(cert);

  return new tls.TLSSocket(socket, {
    isServer: true,
    key: keyPem,
    cert: certPem,
  });
}
