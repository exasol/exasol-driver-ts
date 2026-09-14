import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
const projects = [
  'tsconfig.json',
  'tsconfig.scripts.json',
  'tsconfig.spec.dom.json',
  'tsconfig.spec.json',
  'tsconfig.vitest.json',
];

/**
 * @param {string} project TypeScript project configuration file
 * @returns {Promise<void>} completion of the type check
 */
async function typecheck(project) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, ['--noEmit', '--project', project], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`${command} ${project} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`));
      }
    });
  });
}

for (const project of projects) {
  await typecheck(project);
}
