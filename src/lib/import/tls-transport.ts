import * as crypto from 'node:crypto';
import * as tls from 'node:tls';
import * as net from 'node:net';

// [impl->dsn~runtime-csv-import-file-stream~1]
export interface AdHocCertificate {
  key: string;
  cert: string;
  fingerprint: string;
}

export function generateAdHocCertificate(): AdHocCertificate {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

  const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
  const fingerprint = computeFingerprint(spkiDer);

  const certDer = buildSelfSignedCertificate(spkiDer, privateKey);
  const cert = derToPem(certDer, 'CERTIFICATE');
  const key = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  return { key, cert, fingerprint };
}

function computeFingerprint(spkiDer: Buffer): string {
  // sha256 over the DER of the SubjectPublicKeyInfo, byte-identical to the
  // legacy forge path (publicKeyToAsn1 -> toDer -> sha256 -> base64).
  const base64Hash = crypto.createHash('sha256').update(spkiDer).digest('base64');
  return `sha256//${base64Hash}`;
}

export function wrapWithTls(socket: net.Socket, key: string, cert: string): tls.TLSSocket {
  return new tls.TLSSocket(socket, {
    isServer: true,
    key,
    cert,
  });
}

// --- Minimal ASN.1 DER encoder, scoped to building a self-signed X.509 v3 cert. ---

// node:crypto exposes no certificate builder, so the TBSCertificate is assembled
// by hand and signed with sha256WithRSAEncryption (PKCS#1 v1.5).

const TAG_INTEGER = 0x02;
const TAG_BIT_STRING = 0x03;
const TAG_NULL = 0x05;
const TAG_OID = 0x06;
const TAG_UTF8_STRING = 0x0c;
const TAG_UTC_TIME = 0x17;
const TAG_SEQUENCE = 0x30;
const TAG_SET = 0x31;

function encodeLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length]);
  }
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function encode(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

function encodeSequence(...elements: Buffer[]): Buffer {
  return encode(TAG_SEQUENCE, Buffer.concat(elements));
}

function encodeSet(...elements: Buffer[]): Buffer {
  return encode(TAG_SET, Buffer.concat(elements));
}

function encodeInteger(value: Buffer): Buffer {
  let bytes = value;
  // Strip leading zero bytes (keep at least one byte).
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0x00) {
    start++;
  }
  bytes = bytes.subarray(start);
  // Prepend a zero byte if the high bit is set, to keep the integer positive.
  if (bytes.length > 0 && (bytes[0] & 0x80) !== 0) {
    bytes = Buffer.concat([Buffer.from([0x00]), bytes]);
  }
  return encode(TAG_INTEGER, bytes);
}

function encodeIntegerFromNumber(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;
  do {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  } while (remaining > 0);
  return encodeInteger(Buffer.from(bytes));
}

function encodeBitString(content: Buffer): Buffer {
  // 0 unused bits.
  return encode(TAG_BIT_STRING, Buffer.concat([Buffer.from([0x00]), content]));
}

function encodeOid(oid: string): Buffer {
  const parts = oid.split('.').map((p) => parseInt(p, 10));
  const first = 40 * parts[0] + parts[1];
  const bytes: number[] = [first];
  for (let i = 2; i < parts.length; i++) {
    let value = parts[i];
    const stack: number[] = [];
    stack.unshift(value & 0x7f);
    value >>= 7;
    while (value > 0) {
      stack.unshift((value & 0x7f) | 0x80);
      value >>= 7;
    }
    bytes.push(...stack);
  }
  return encode(TAG_OID, Buffer.from(bytes));
}

function encodeUtf8String(value: string): Buffer {
  return encode(TAG_UTF8_STRING, Buffer.from(value, 'utf8'));
}

function encodeUtcTime(date: Date): Buffer {
  // UTCTime, YYMMDDHHMMSSZ (valid through 2049).
  const pad = (n: number): string => n.toString().padStart(2, '0');
  const yy = pad(date.getUTCFullYear() % 100);
  const value =
    yy +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z';
  return encode(TAG_UTC_TIME, Buffer.from(value, 'ascii'));
}

function encodeContext(tagNumber: number, content: Buffer): Buffer {
  // Constructed, context-specific tag.
  return encode(0xa0 | tagNumber, content);
}

// OID 2.5.4.3 = commonName, 1.2.840.113549.1.1.11 = sha256WithRSAEncryption.
const OID_COMMON_NAME = '2.5.4.3';
const OID_SHA256_WITH_RSA = '1.2.840.113549.1.1.11';

function encodeName(commonName: string): Buffer {
  const attribute = encodeSequence(encodeOid(OID_COMMON_NAME), encodeUtf8String(commonName));
  const rdn = encodeSet(attribute);
  return encodeSequence(rdn);
}

function encodeSignatureAlgorithm(): Buffer {
  return encodeSequence(encodeOid(OID_SHA256_WITH_RSA), encode(TAG_NULL, Buffer.alloc(0)));
}

function buildSelfSignedCertificate(spkiDer: Buffer, privateKey: crypto.KeyObject): Buffer {
  const notBefore = new Date();
  const notAfter = new Date(notBefore);
  notAfter.setFullYear(notAfter.getFullYear() + 1);

  const name = encodeName('exasol-driver-ts');

  const version = encodeContext(0, encodeIntegerFromNumber(2)); // v3 == 2
  const serialNumber = encodeIntegerFromNumber(1); // serial 01
  const signatureAlgorithm = encodeSignatureAlgorithm();
  const validity = encodeSequence(encodeUtcTime(notBefore), encodeUtcTime(notAfter));

  const tbsCertificate = encodeSequence(
    version,
    serialNumber,
    signatureAlgorithm,
    name, // issuer
    validity,
    name, // subject
    spkiDer, // subjectPublicKeyInfo (already a complete DER SEQUENCE)
  );

  const signature = crypto.sign('sha256', tbsCertificate, privateKey);

  return encodeSequence(tbsCertificate, encodeSignatureAlgorithm(), encodeBitString(signature));
}

function derToPem(der: Buffer, label: string): string {
  const base64 = der.toString('base64');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}
