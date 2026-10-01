import { spawn } from 'node:child_process';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface PackageConsumer {
  directory: string;
  cleanup(): Promise<void>;
}

export async function preparePackageConsumer(): Promise<PackageConsumer> {
  const packageDirectory = await mkdtemp(join(tmpdir(), 'exasol-driver-package-'));
  const consumerDirectory = join(packageDirectory, 'consumer');
  try {
    await runCommand('npm', ['run', 'build'], undefined, undefined, true);
    await runCommand('npm', ['pack', '--pack-destination', packageDirectory, '--ignore-scripts'], undefined, undefined, true);
    const tarballFile = (await readdir(packageDirectory)).find((file) => file.endsWith('.tgz'));
    if (!tarballFile) {
      throw new Error('npm pack did not create a tarball.');
    }
    await cp('integration-test/package/consumer', consumerDirectory, { recursive: true });
    await runCommand('npm', ['install', '--ignore-scripts', join(packageDirectory, tarballFile), 'ws@8.21.3'], consumerDirectory, undefined, true);
  } catch (error) {
    await rm(packageDirectory, { recursive: true, force: true });
    throw error;
  }

  return {
    directory: consumerDirectory,
    cleanup: () => rm(packageDirectory, { recursive: true, force: true }),
  };
}

export function runCommand(command: string, arguments_: string[], cwd = process.cwd(), env = process.env, useWindowsShim = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const executable = useWindowsShim && process.platform === 'win32' ? `${command}.cmd` : command;
    const child = spawn(executable, arguments_, { cwd, env, stdio: 'inherit' });
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
