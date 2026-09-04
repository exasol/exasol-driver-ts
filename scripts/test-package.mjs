import { spawn } from 'node:child_process';

const executableSuffix = process.platform === 'win32' ? '.cmd' : '';
const smokeTest = 'integration-test/package/browser-package-smoke.ts';
const compilerOptions = ['--ignoreConfig', '--noEmit', '--target', 'ES2022', '--lib', 'ES2022,ESNext.Disposable,DOM'];

async function run(command, arguments_, useWindowsShim = false) {
  await new Promise((resolve, reject) => {
    const executable = useWindowsShim ? `${command}${executableSuffix}` : command;
    const child = spawn(executable, arguments_, { stdio: 'inherit' });
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

await run('npm', ['run', 'build'], true);
// Keep typechecking compatible with bundler-based TypeScript consumers.
await run('tsc', [...compilerOptions, '--module', 'ESNext', '--moduleResolution', 'Bundler', smokeTest], true);
// Verify declarations work for NodeNext consumers, which require explicit ESM extensions.
await run('tsc', [...compilerOptions, '--module', 'NodeNext', '--moduleResolution', 'NodeNext', smokeTest], true);
await run(process.execPath, ['integration-test/package/browser-package-smoke.mjs']);
