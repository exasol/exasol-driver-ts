import { DsnHost, MAX_DSN_HOSTS, parseDsn, shuffle, stripIpv6Brackets } from './utils';

const hosts = (port: number, ...names: string[]): DsnHost[] => names.map((host) => ({ host, port, fingerprint: undefined }));

describe('utils', () => {
  describe('parseDsn', () => {
    // [utest->dsn~runtime-dsn-parsing~1]
    it.each`
      dsn                                  | parsed
      ${'localhost'}                       | ${hosts(8563, 'localhost')}
      ${'exasol1,127.0.0.1,exasol3'}       | ${hosts(8563, 'exasol1', '127.0.0.1', 'exasol3')}
      ${'exasol1, exasol2'}                | ${hosts(8563, 'exasol1', 'exasol2')}
      ${'exasol1..3'}                      | ${hosts(8563, 'exasol1', 'exasol2', 'exasol3')}
      ${'10.0.0.10..12'}                   | ${hosts(8563, '10.0.0.10', '10.0.0.11', '10.0.0.12')}
      ${'node08..10.example.com'}          | ${hosts(8563, 'node08.example.com', 'node09.example.com', 'node10.example.com')}
      ${'exasolX..Y'}                      | ${hosts(8563, 'exasolX..Y')}
      ${'localhost:8888'}                  | ${hosts(8888, 'localhost')}
      ${'localhost:'}                      | ${hosts(8563, 'localhost')}
      ${'exasol1..2,exasol5:9000'}         | ${hosts(9000, 'exasol1', 'exasol2', 'exasol5')}
      ${'exasol1,,exasol2'}                | ${hosts(8563, 'exasol1', 'exasol2')}
      ${'[::1]'}                           | ${hosts(8563, '[::1]')}
      ${'[fe80::1],exasol1:8564'}          | ${hosts(8564, '[fe80::1]', 'exasol1')}
      ${'my_host-1.example.com'}           | ${hosts(8563, 'my_host-1.example.com')}
      ${'datenbank.müller.de'}             | ${hosts(8563, 'datenbank.müller.de')}
      ${'knoten1..2.müller.de'}            | ${hosts(8563, 'knoten1.müller.de', 'knoten2.müller.de')}
    `('parses "$dsn"', ({ dsn, parsed }: { dsn: string; parsed: DsnHost[] }) => {
      expect(parseDsn(dsn, 8563)).toEqual(parsed);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('applies a port only to its own part and the preceding parts without a port', () => {
      expect(parseDsn('a:1000,b,c:2000,d', 8563)).toEqual([
        { host: 'a', port: 1000, fingerprint: undefined },
        { host: 'b', port: 2000, fingerprint: undefined },
        { host: 'c', port: 2000, fingerprint: undefined },
        { host: 'd', port: 8563, fingerprint: undefined },
      ]);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it.each`
      dsn                                    | fingerprint
      ${'10.0.0.11/135a1d2dce10:8563'}       | ${'135A1D2DCE10'}
      ${'10.0.0.11/nocertcheck'}             | ${'NOCERTCHECK'}
    `('parses fingerprint in "$dsn"', ({ dsn, fingerprint }: { dsn: string; fingerprint: string }) => {
      expect(parseDsn(dsn, 8563)).toEqual([{ host: '10.0.0.11', port: 8563, fingerprint }]);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('applies a fingerprint to all hosts of a range', () => {
      expect(parseDsn('exasol1..2/abc', 8563).map((host) => host.fingerprint)).toEqual(['ABC', 'ABC']);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('parses an IPv6 address with port and fingerprint', () => {
      expect(parseDsn('[2001:db8::1]/abc:8888', 8563)).toEqual([{ host: '[2001:db8::1]', port: 8888, fingerprint: 'ABC' }]);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('accepts the maximum number of hosts', () => {
      expect(parseDsn(`node1..${MAX_DSN_HOSTS}`, 8563)).toHaveLength(MAX_DSN_HOSTS);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it.each`
      dsn                          | reported
      ${'node1..10001'}            | ${'node1..10001'}
      ${'a1..6000,b1..6000'}       | ${'a1..6000,b1..6000'}
    `('throws E-EDJS-43 when "$dsn" expands to too many hosts', ({ dsn, reported }: { dsn: string; reported: string }) => {
      expect(() => parseDsn(dsn, 8563)).toThrow(`E-EDJS-43: Connection string '${reported}' expands to more than '10000' hosts.`);
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('throws E-EDJS-39 for a missing connection string', () => {
      expect(() => parseDsn(undefined, 8563)).toThrow("E-EDJS-39: Invalid connection string 'undefined'.");
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it('throws E-EDJS-9 for an invalid range', () => {
      expect(() => parseDsn('exasol3..1', 8563)).toThrow("E-EDJS-9: Invalid host range limits: 'exasol3..1'.");
    });

    // [utest->dsn~runtime-dsn-parsing~1]
    it.each`
      dsn                         | part
      ${''}                       | ${''}
      ${' , '}                    | ${' , '}
      ${'localhost:abc'}          | ${'localhost:abc'}
      ${'localhost:0'}            | ${'localhost:0'}
      ${'localhost:65536'}        | ${'localhost:65536'}
      ${'localhost:8563/abc'}     | ${'localhost:8563/abc'}
      ${'localhost/not-hex'}      | ${'localhost/not-hex'}
      ${':8563'}                  | ${':8563'}
      ${'[::1'}                   | ${'[::1'}
      ${'[::1]..3'}               | ${'[::1]..3'}
      ${'exa[sol'}                | ${'exa[sol'}
      ${'exasol1..3]'}            | ${'exasol1..3]'}
      ${'host?x:8563'}            | ${'host?x:8563'}
      ${'a@b:8563'}               | ${'a@b:8563'}
      ${'exa sol'}                | ${'exa sol'}
      ${'exa#sol'}                | ${'exa#sol'}
      ${'..'}                     | ${'..'}
      ${'-'}                      | ${'-'}
      ${'_host'}                  | ${'_host'}
      ${'.exasol1..3'}            | ${'.exasol1..3'}
    `('throws E-EDJS-39 for invalid DSN "$dsn"', ({ dsn, part }: { dsn: string; part: string }) => {
      expect(() => parseDsn(dsn, 8563)).toThrow(`E-EDJS-39: Invalid connection string '${part}'.`);
    });
  });

  describe('shuffle', () => {
    // [utest->dsn~runtime-dsn-failover~1]
    it('returns all items in an order given by the random function', () => {
      expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
      expect(shuffle(['a', 'b', 'c'], () => 0.999)).toEqual(['a', 'b', 'c']);
    });

    it('does not modify the input', () => {
      const input = ['a', 'b'];
      shuffle(input, () => 0);
      expect(input).toEqual(['a', 'b']);
    });
  });

  describe('stripIpv6Brackets', () => {
    it.each`
      host           | expected
      ${'[::1]'}     | ${'::1'}
      ${'localhost'} | ${'localhost'}
    `('returns "$expected" for "$host"', ({ host, expected }: { host: string; expected: string }) => {
      expect(stripIpv6Brackets(host)).toBe(expected);
    });
  });
});
