/* eslint-disable jest/no-conditional-expect */
import { resolveHosts } from './utils';

describe('utils', () => {
  it.each`
    host                           | parsed
    ${'localhost'}                 | ${['localhost']}
    ${'exasol1,127.0.0.1,exasol3'} | ${['exasol1', '127.0.0.1', 'exasol3']}
    ${'exasol1..3'}                | ${['exasol1', 'exasol2', 'exasol3']}
    ${'exasolX..Y'}                | ${['exasolX..Y']}
  `(
    // eslint-disable-next-line quotes
    `should work resolve host for "$host"`,
    async ({ host, parsed }: { host: string; parsed: string[] }) => {
      expect(await resolveHosts(host)).toEqual(parsed);
    }
  );

  it('should throw error when invalid range', async () => {
    expect.assertions(2);
    return resolveHosts('exasol3..1').catch((err: Error) => {
      expect(err.message).toEqual("E-EDJS-9: Invalid host range limits: 'exasol3..1'.");
      expect(err.name).toEqual('ExaError');
    });
  });
});
