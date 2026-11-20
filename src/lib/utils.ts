import { newInvalidDsnError, newInvalidHostRangeLimits, newTooManyDsnHostsError } from './errors/errors';

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
// Groups: 1 bracketed IPv6 address, 2 host prefix, 3 range start, 4 range end, 5 host suffix, 6 fingerprint, 7 port.
const dsnPartRegex =
  /^(?:(\[[0-9a-f:.]+\])|([^:/[\]]+?)(?:(\d+)\.\.(\d+)([^:/]*?))?)(?:\/([0-9a-f]+|nocertcheck))?(?::(\d+)?)?$/i;

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
  const parts = dsn.split(',').map((part) => part.trim()).reverse();
  for (const part of parts) {
    if (part.length === 0) {
      continue;
    }
    const match = dsnPartRegex.exec(part);
    if (!match) {
      throw newInvalidDsnError(part);
    }
    const [, ipv6Address, prefix, rangeStart, rangeEnd, suffix, fingerprint, port] = match;
    if (port) {
      currentPort = parsePort(port, part);
    }
    if (fingerprint) {
      currentFingerprint = fingerprint.toUpperCase();
    }
    const hosts = ipv6Address ? [ipv6Address] : rangeStart ? expandRange(part, prefix, rangeStart, rangeEnd, suffix) : [prefix];
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

const parsePort = (port: string, part: string): number => {
  const value = parseInt(port, 10);
  if (value < 1 || value > MAX_PORT) {
    throw newInvalidDsnError(part);
  }
  return value;
};

const expandRange = (part: string, prefix: string, rangeStart: string, rangeEnd: string, suffix: string = ''): string[] => {
  const lower = parseInt(rangeStart, 10);
  const upper = parseInt(rangeEnd, 10);
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
