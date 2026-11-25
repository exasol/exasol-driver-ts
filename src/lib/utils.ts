import { newInvalidDsnError, newInvalidFingerprintLengthError, newInvalidHostRangeLimits, newTooManyDsnHostsError } from './errors/errors';
import { NO_CERTIFICATE_CHECK } from './server-certificate';

/** Number of hexadecimal characters of a SHA-256 certificate fingerprint. */
const SHA256_FINGERPRINT_LENGTH = 64;

/** One connection target resolved from an Exasol connection string (DSN). */
export interface DsnHost {
  /** Host name or IP address. IPv6 addresses are enclosed in brackets, e.g. `[::1]`. */
  host: string;
  port: number;
  /** Certificate fingerprint given in the DSN, upper-cased, or `NOCERTCHECK`. */
  fingerprint?: string;
}

// Same syntax as the other Exasol drivers (e.g. pyexasol):
// host prefix, optional numeric range with optional suffix, optional fingerprint, optional port.
// Host names must start with a letter or digit and may only contain letters, digits, `.`, `-` and `_`, so that the host
// and port end up in the WebSocket URL exactly as written (pyexasol rejects other names when resolving them, which this
// driver does not do). Non-ASCII letters (\u00a0-\uffff) are allowed for internationalized domain names.
// Groups: 1 bracketed IPv6 address, 2 host prefix, 3 range start, 4 range end, 5 host suffix, 6 fingerprint, 7 port.
// The expression mirrors pyexasol's DSN regex so both can be compared directly. Its backtracking is acceptable because it
// only parses the application's own connection configuration, one comma-separated part at a time.
const dsnPartRegex =
  /^(?:(\[[0-9a-f:.]+\])|([a-z0-9\u00a0-\uffff][a-z0-9\u00a0-\uffff._-]*?)(?:(\d+)\.\.(\d+)([a-z0-9\u00a0-\uffff._-]*?))?)(?:\/([0-9a-f]+|nocertcheck))?(?::(\d+)?)?$/i; // NOSONAR

const MAX_PORT = 65535;
/** Upper limit for the number of hosts a connection string may expand to, protecting against typos in ranges. */
export const MAX_DSN_HOSTS = 10_000;

/**
 * Parses an Exasol connection string of the form `host[..range][/fingerprint][:port][,host...]`.
 * A host can also be an IPv6 address in brackets, e.g. `[::1]:8563`.
 *
 * - Ranges expand the last number of the host name, keeping a suffix and zero padding
 *   (`10.0.0.10..12`, `exasol1..3`, `node01..03.example.com`).
 * - A port or fingerprint applies to its own part and all preceding parts that do not define their own,
 *   so `host1,host2:8564` uses port 8564 for both hosts.
 * - Parts without a port use `defaultPort`.
 *
 * @returns the expanded hosts in DSN order
 */
export const parseDsn = (dsn: string | undefined, defaultPort: number): DsnHost[] => {
  // [impl->dsn~runtime-dsn-parsing~1]
  // Guard against `host: undefined` or other non-string values from untyped configuration.
  if (typeof dsn !== 'string' || dsn.trim().length === 0) {
    throw newInvalidDsnError(String(dsn));
  }
  let currentPort = defaultPort;
  let currentFingerprint: string | undefined;
  const result: DsnHost[] = [];

  // Port and fingerprint are applied backwards, so iterate the parts in reverse order.
  const parts = dsn
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .reverse();
  for (const part of parts) {
    const { hosts, fingerprint, port } = parsePart(part);
    if (port) {
      currentPort = parsePort(port, part);
    }
    if (fingerprint) {
      currentFingerprint = parseFingerprint(fingerprint);
    }
    if (result.length + hosts.length > MAX_DSN_HOSTS) {
      throw newTooManyDsnHostsError(dsn, MAX_DSN_HOSTS);
    }
    result.unshift(...hosts.map((host) => ({ host, port: currentPort, fingerprint: currentFingerprint })));
  }
  if (result.length === 0) {
    throw newInvalidDsnError(dsn);
  }
  return result;
};

/** Splits one part of a connection string into its expanded hosts, fingerprint and port. */
const parsePart = (part: string): { hosts: string[]; fingerprint?: string; port?: string } => {
  const match = dsnPartRegex.exec(part);
  if (!match) {
    throw newInvalidDsnError(part);
  }
  const [, ipv6Address, prefix, rangeStart, rangeEnd, suffix, fingerprint, port] = match;
  if (ipv6Address) {
    return { hosts: [ipv6Address], fingerprint, port };
  }
  const hosts = rangeStart ? expandRange(part, prefix, rangeStart, rangeEnd, suffix) : [prefix];
  return { hosts, fingerprint, port };
};

/** Upper-cases a fingerprint and checks that it is `NOCERTCHECK` or has the length of a SHA-256 fingerprint. */
const parseFingerprint = (fingerprint: string): string => {
  const normalized = fingerprint.toUpperCase();
  if (normalized !== NO_CERTIFICATE_CHECK && normalized.length !== SHA256_FINGERPRINT_LENGTH) {
    throw newInvalidFingerprintLengthError(fingerprint, fingerprint.length);
  }
  return normalized;
};

const parsePort = (port: string, part: string): number => {
  const value = Number.parseInt(port, 10);
  if (value < 1 || value > MAX_PORT) {
    throw newInvalidDsnError(part);
  }
  return value;
};

const expandRange = (part: string, prefix: string, rangeStart: string, rangeEnd: string, suffix: string = ''): string[] => {
  const lower = Number.parseInt(rangeStart, 10);
  const upper = Number.parseInt(rangeEnd, 10);
  if (upper < lower) {
    throw newInvalidHostRangeLimits(part);
  }
  if (upper - lower + 1 > MAX_DSN_HOSTS) {
    throw newTooManyDsnHostsError(part, MAX_DSN_HOSTS);
  }
  const hosts: string[] = [];
  for (let index = lower; index <= upper; index++) {
    hosts.push(`${prefix}${String(index).padStart(rangeStart.length, '0')}${suffix}`);
  }
  return hosts;
};

/** Returns a copy of `items` in random order (Fisher-Yates shuffle). */
export const shuffle = <T>(items: readonly T[], random: () => number = Math.random): T[] => {
  // [impl->dsn~runtime-dsn-failover~1]
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

/** Removes the brackets around an IPv6 address, e.g. for opening a TCP socket. */
export const stripIpv6Brackets = (host: string): string => host.replace(/^\[(.*)\]$/, '$1');
