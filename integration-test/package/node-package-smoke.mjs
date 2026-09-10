import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const declarations = await readFile(new URL('../../dist/index.d.ts', import.meta.url), 'utf8');
for (const match of declarations.matchAll(/(?:from\s*|import\()\s*['"](\.\.?\/[^'"]+)['"]/g)) {
  assert.ok(match[1].endsWith('.js'), `index.d.ts contains an extensionless relative specifier: ${match[1]}`);
}

const require = createRequire(import.meta.url);
const nodeEsmExports = await import('@exasol/exasol-driver-ts');
const nodeCjsExports = require('@exasol/exasol-driver-ts');
const fakeWebSocketFactory = () => ({});
for (const nodeExports of [nodeEsmExports, nodeCjsExports]) {
  const driver = new nodeExports.ExasolDriver(fakeWebSocketFactory, { accessToken: 'access-token' });
  new nodeExports.ExasolPool(fakeWebSocketFactory, { accessToken: 'access-token' });
  assert.equal(typeof driver.importFromCsvFile, 'function');
  assert.equal(typeof driver.exportToCsvFile, 'function');
}
