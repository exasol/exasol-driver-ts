import { spawn } from 'node:child_process';

const executableSuffix = process.platform === 'win32' ? '.cmd' : '';
const smokeTest = 'integration-test/package/browser-package-smoke.ts';
const compilerOptions = ['--ignoreConfig', '--noEmit', '--target', 'ES2022', '--lib', 'ES2022,ESNext.Disposable,DOM'];

async function run(command, arguments_) {
  await new Promise((resolve, reject) => {
    const child = spawn(`${command}${executableSuffix}`, arguments_, { stdio: 'inherit' });
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

await run('npm', ['run', 'build']);
// Keep typechecking compatible with bundler-based TypeScript consumers.
await run('tsc', [...compilerOptions, '--module', 'ESNext', '--moduleResolution', 'Bundler', smokeTest]);
// Verify declarations work for NodeNext consumers, which require explicit ESM extensions.
await run('tsc', [...compilerOptions, '--module', 'NodeNext', '--moduleResolution', 'NodeNext', smokeTest]);
await run('node', ['integration-test/package/browser-package-smoke.mjs']);
