import { ExaWebsocket } from './connection';
import { newFingerprintMismatchError, newFingerprintNotVerifiableError } from './errors/errors';
import { CertificateCheckFailure } from './server-certificate';

interface PeerCertificateSocket {
  getPeerCertificate?: () => { fingerprint256?: string } | null | undefined;
}

/** The part of a `ws` WebSocket used to read the server certificate after the TLS handshake. */
interface UpgradeEventEmitter {
  once(event: 'upgrade', listener: (response: { socket?: PeerCertificateSocket }) => void): unknown;
}

const hasOnce = (webSocket: ExaWebsocket): webSocket is ExaWebsocket & UpgradeEventEmitter =>
  typeof (webSocket as Partial<UpgradeEventEmitter>).once === 'function';

/**
 * Normalizes a SHA-256 fingerprint like Node.js `fingerprint256` (`AB:CD:...`) to the connection string format,
 * upper-case hexadecimal without separators. This is the format pyexasol uses as well.
 */
export const normalizeFingerprint = (fingerprint: string): string => fingerprint.replace(/:/g, '').toUpperCase();

/**
 * Verifies the server certificate fingerprint of a `ws` WebSocket. `ws` emits `upgrade` after the TLS handshake and
 * before `open`, and stops the connection when the WebSocket is closed in the listener, so no credentials or Exasol
 * commands are sent to a server with a different certificate. Only the WebSocket upgrade request has been sent then. Fails closed when the WebSocket does not expose the certificate.
 */
export const verifyServerCertificateFingerprint = (
  webSocket: ExaWebsocket,
  host: string,
  expectedFingerprint: string,
  fail: CertificateCheckFailure,
): (() => boolean) => {
  // [impl->dsn~runtime-fingerprint-verification~1]
  // [impl->dsn~decision-verify-fingerprint-on-upgrade~1]
  let verified = false;
  if (!hasOnce(webSocket)) {
    fail(newFingerprintNotVerifiableError(host), true);
    return () => verified;
  }
  webSocket.once('upgrade', (response) => {
    const fingerprint = response?.socket?.getPeerCertificate?.()?.fingerprint256;
    if (!fingerprint) {
      fail(newFingerprintNotVerifiableError(host), true);
      return;
    }
    const actualFingerprint = normalizeFingerprint(fingerprint);
    if (actualFingerprint !== expectedFingerprint) {
      fail(newFingerprintMismatchError(host, expectedFingerprint, actualFingerprint), false);
      return;
    }
    verified = true;
  });
  return () => verified;
};
