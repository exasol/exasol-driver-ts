import { spawn } from 'node:child_process';

const browserSmokeTest = 'integration-test/package/browser-package-smoke.ts';
const nodeSmokeTest = 'integration-test/package/node-package-smoke.ts';
const compilerOptions = ['--ignoreConfig', '--noEmit', '--target', 'ES2022', '--lib', 'ES2022,ESNext.Disposable,DOM'];

/**
 * @param {string} command executable name
 * @param {string[]} arguments_ executable arguments
 * @param {boolean} [useWindowsShim] whether to use the Windows command shim
 * @returns {Promise<void>} completion of the child process
 */
async function run(command, arguments_, useWindowsShim = false) {
  await new Promise((resolve, reject) => {
    const executable = useWindowsShim && process.platform === 'win32' ? `${command}.cmd` : command;
    const child = spawn(executable, arguments_, { stdio: 'inherit' });
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
