import { spawn } from 'node:child_process';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExasolContainer, startNewDockerContainer } from '../exasolContainer';

const describeWhenSupported = ExasolContainer.supportsEncryptedImportExport() ? describe : describe.skip;

// [itest->dsn~decision-publish-cjs-and-esm~3]
// [itest->dsn~runtime-connect-basic-authentication~1]
// [itest->dsn~runtime-csv-import-file-stream~1]
describeWhenSupported('Packed package consumers', () => {
  let packageDirectory = '';
  let consumerDirectory = '';
  let fixtureEnvironment: NodeJS.ProcessEnv;

  jest.setTimeout(7_000_000);

  beforeAll(async () => {
    const container = await startNewDockerContainer();
    packageDirectory = await mkdtemp(join(tmpdir(), 'exasol-driver-package-'));
    consumerDirectory = join(packageDirectory, 'consumer');
    await run('npm', ['run', 'build']);
    await run('npm', ['pack', '--pack-destination', packageDirectory, '--ignore-scripts']);
    const tarballFile = (await readdir(packageDirectory)).find((file) => file.endsWith('.tgz'));
    if (!tarballFile) {
      throw new Error('npm pack did not create a tarball.');
    }
    const tarball = join(packageDirectory, tarballFile);
    await cp('integration-test/package/consumer', consumerDirectory, { recursive: true });
    await run('npm', ['install', '--ignore-scripts', tarball, 'ws@8.21.3'], consumerDirectory);
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
    if (packageDirectory) {
      await rm(packageDirectory, { recursive: true, force: true });
    }
  });

  it.each(['node-esm.mjs', 'node-cjs.cjs', 'browser-esm.mjs', 'browser-cjs.cjs'])('runs %s against Exasol', async (fixture) => {
    await run(process.execPath, [fixture], consumerDirectory, fixtureEnvironment);
  });
});

function run(command: string, arguments_: string[], cwd = process.cwd(), env = process.env): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`));
      }
    });
  });
}
