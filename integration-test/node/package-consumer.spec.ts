import { ExasolContainer, startNewDockerContainer } from '../exasolContainer';
import { PackageConsumer, preparePackageConsumer, runCommand } from '../package/package-consumer';

const describeWhenSupported = ExasolContainer.supportsEncryptedImportExport() ? describe : describe.skip;

// [itest->dsn~decision-publish-cjs-and-esm~3]
// [itest->dsn~runtime-connect-basic-authentication~1]
// [itest->dsn~runtime-csv-import-file-stream~1]
describeWhenSupported('Packed package consumers', () => {
  let consumer: PackageConsumer;
  let fixtureEnvironment: NodeJS.ProcessEnv;

  jest.setTimeout(7_000_000);

  beforeAll(async () => {
    const container = await startNewDockerContainer();
    consumer = await preparePackageConsumer();
    const ca = await container.loadCA();
    if (!ca) {
      throw new Error('Exasol container did not provide a CA certificate.');
    }
    fixtureEnvironment = {
      ...process.env,
      EXASOL_HOST: container.getHost(),
      EXASOL_PORT: String(container.getPort()),
      EXASOL_CA_BASE64: Buffer.from(ca).toString('base64'),
      NODE_OPTIONS: undefined,
    };
  });

  afterAll(async () => {
    await consumer?.cleanup();
  });

  it.each(['node-esm.mjs', 'node-cjs.cjs', 'browser-esm.mjs', 'browser-cjs.cjs'])('runs %s against Exasol', async (fixture) => {
    await runCommand(process.execPath, [fixture], consumer.directory, fixtureEnvironment);
  });
});
