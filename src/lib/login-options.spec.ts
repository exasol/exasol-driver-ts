import { createLoginOptions } from './login-options';

describe('createLoginOptions', () => {
  // [utest->dsn~runtime-login-metadata~1]
  it('uses configured login metadata instead of platform defaults', async () => {
    const options = createLoginOptions(
      {
        autocommit: true,
        clientName: 'client-name',
        clientOs: 'configured-os',
        clientOsUsername: 'configured-user',
        clientRuntime: 'configured-runtime',
        clientVersion: 'client-version',
        compression: false,
      },
      { navigator: { platform: 'browser-os', userAgent: 'browser-runtime' } },
    );

    expect(options).toMatchObject({
      clientName: 'client-name',
      clientOs: 'configured-os',
      clientOsUsername: 'configured-user',
      clientRuntime: 'configured-runtime',
      clientVersion: 'client-version',
    });
  });

  // [utest->dsn~runtime-login-metadata~1]
  it('uses browser metadata when no configured metadata is provided', async () => {
    const options = createLoginOptions(
      {
        autocommit: true,
        clientName: 'client-name',
        clientVersion: 'client-version',
        compression: false,
      },
      { navigator: { platform: 'browser-os', userAgent: 'browser-runtime' } },
    );

    expect(options).toMatchObject({
      clientOs: 'browser-os',
      clientOsUsername: undefined,
      clientRuntime: 'browser-runtime',
    });
  });
});
