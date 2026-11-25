import { ExaWebsocket } from './connection';

/**
 * Reports a failed server certificate check. With `retryOtherHosts: false` the driver does not try further hosts.
 * @internal
 */
export type CertificateCheckFailure = (error: Error, retryOtherHosts: boolean) => void;

/**
 * Checks the certificate fingerprint of a WebSocket that is still opening, after the TLS handshake and before the
 * driver sends credentials or any Exasol command. The WebSocket upgrade request has already been sent at that point.
 * Calls `fail` when the fingerprint does not match or cannot be read.
 * Returns a function that tells whether the fingerprint was verified; the driver only uses the WebSocket when it was.
 * @internal
 */
export type ServerCertificateVerifier = (
  webSocket: ExaWebsocket,
  host: string,
  expectedFingerprint: string,
  fail: CertificateCheckFailure,
) => () => boolean;

/** Fingerprint value in a connection string that disables the server certificate check for its hosts. */
export const NO_CERTIFICATE_CHECK = 'NOCERTCHECK';
