import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'playwright.cmd' : 'playwright';
const arguments_ = ['install'];

if (process.env['GITHUB_ACTIONS'] === 'true') {
  arguments_.push('--with-deps');
}

arguments_.push('chromium');

const child = spawn(command, arguments_, { stdio: 'inherit' });

child.on('error', (error) => {
  throw error;
});

child.on('exit', (code, signal) => {
  if (code === 0) {
    return;
  }
  throw new Error(`${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`);
});
