import { spawn } from 'node:child_process';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browserSmokeTest = 'integration-test/package/browser-package-smoke.ts';
const nodeSmokeTest = 'integration-test/package/node-package-smoke.ts';
const compilerOptions = ['--ignoreConfig', '--noEmit', '--target', 'ES2022', '--lib', 'ES2022,ESNext.Disposable,DOM'];

/**
 * @param {string} command executable name
 * @param {string[]} arguments_ executable arguments
 * @param {boolean} [useWindowsShim] whether to use the Windows command shim
 * @param {string} [cwd] working directory for the child process
 * @returns {Promise<void>} completion of the child process
 */
async function run(command, arguments_, useWindowsShim = false, cwd = undefined) {
  await new Promise((resolve, reject) => {
    const executable = useWindowsShim && process.platform === 'win32' ? `${command}.cmd` : command;
    const child = spawn(executable, arguments_, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`));
      }
    });
  });
}

await run('npm', ['run', 'build'], true);
// Keep typechecking compatible with bundler-based TypeScript consumers.
await run('tsc', [...compilerOptions, '--module', 'ESNext', '--moduleResolution', 'Bundler', browserSmokeTest, nodeSmokeTest], true);
// Verify declarations work for NodeNext consumers, which require explicit ESM extensions.
await run('tsc', [...compilerOptions, '--module', 'NodeNext', '--moduleResolution', 'NodeNext', browserSmokeTest, nodeSmokeTest], true);
await run(process.execPath, ['integration-test/package/browser-package-smoke.mjs']);
await run(process.execPath, ['integration-test/package/node-package-smoke.mjs']);

const packageDirectory = await mkdtemp(join(tmpdir(), 'exasol-driver-package-'));
try {
  await run('npm', ['pack', '--pack-destination', packageDirectory, '--ignore-scripts'], true);
  const tarballFile = (await readdir(packageDirectory)).find((file) => file.endsWith('.tgz'));
  if (!tarballFile) {
    throw new Error('npm pack did not create a tarball.');
  }
  const tarball = join(packageDirectory, tarballFile);
  const consumerDirectory = join(packageDirectory, 'consumer');
  await cp('integration-test/package/consumer', consumerDirectory, { recursive: true });
  await run('npm', ['install', '--ignore-scripts', tarball], true, consumerDirectory);
  for (const fixture of ['node-esm.mjs', 'node-cjs.cjs', 'browser-esm.mjs', 'browser-cjs.cjs']) {
    console.log(`Running fixture: ${fixture}`);
    await run(process.execPath, [fixture], false, consumerDirectory);
  }
} finally {
  await rm(packageDirectory, { recursive: true, force: true });
}

console.log('Package tests completed successfully.');
