import { createLoginOptions } from './login-options';

describe('createLoginOptions in Node.js', () => {
  // [utest->dsn~runtime-login-metadata~1]
  it('uses operating-system and runtime defaults', async () => {
    const options = await createLoginOptions(
      {
        autocommit: true,
        clientName: 'client-name',
        clientVersion: 'client-version',
        compression: false,
      },
      { process: { arch: 'x64', env: { USER: 'node-user' }, platform: 'linux', version: 'v99.0.0', versions: { node: '99.0.0' } } },
    );

    expect(options).toMatchObject({
      clientOs: 'linux x64',
      clientOsUsername: 'node-user',
      clientRuntime: 'Node.js v99.0.0',
    });
  });

  // [utest->dsn~runtime-login-metadata~1]
  it('preserves configured empty metadata values', async () => {
    const options = await createLoginOptions(
      {
        autocommit: true,
        clientName: 'client-name',
        clientOs: '',
        clientOsUsername: '',
        clientRuntime: '',
        clientVersion: 'client-version',
        compression: false,
      },
      { process: { arch: 'x64', env: { USER: 'node-user' }, platform: 'linux', version: 'v99.0.0', versions: { node: '99.0.0' } } },
    );

    expect(options).toMatchObject({
      clientOs: '',
      clientOsUsername: '',
      clientRuntime: '',
    });
  });
});
