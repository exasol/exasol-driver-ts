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

/**
 * Node.js TLS error codes for server certificates from an unknown certificate authority or for another host name, the
 * typical cases of self-signed certificates where a fingerprint helps. Deliberately leaves out expired certificates and
 * broken signatures, which should be fixed on the server instead of pinned.
 */
const UNTRUSTED_CERTIFICATE_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_UNTRUSTED',
  'INVALID_CA',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Returns the message of an untrusted server certificate error from a WebSocket `error` event, or `undefined` for other
 * errors. `ws` passes an event whose `error` property holds the Node.js TLS error with its `code`.
 * @internal
 */
export const getUntrustedCertificateMessage = (event: unknown): string | undefined => {
  const error: unknown = isObject(event) ? event['error'] : undefined;
  if (!isObject(error)) {
    return undefined;
  }
  const { code, message } = error;
  return typeof code === 'string' && UNTRUSTED_CERTIFICATE_ERROR_CODES.has(code) && typeof message === 'string' ? message : undefined;
};
