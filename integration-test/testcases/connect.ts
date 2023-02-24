import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ExasolDriver, websocketFactory } from '../../src/lib/sql-client';

export const connectTest = (name: string, factory: websocketFactory) =>
  describe(name, () => {
    let container: StartedTestContainer;
    jest.setTimeout(7000000);

    beforeAll(async () => {
      container = await new GenericContainer('exasol/docker-db')
        .withExposedPorts(8563, 2580)
        .withPrivilegedMode()
        .withDefaultLogDriver()
        .withReuse()
        .withWaitStrategy(Wait.forLogMessage('All stages finished'))
        .start();
    });

    it('Connect to DB', async () => {
      const driver = new ExasolDriver(factory, {
        host: container.getHost(),
        port: container.getMappedPort(8563),
        user: 'sys',
        password: 'exasol',
        encryption: false,
      });
      await driver.connect();
      await driver.close();
    });

    afterAll(async () => {
      //  await container.stop();
    });
  });
