import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const factory = () => ({});
const forbiddenModules = ['node:fs', 'node:net', 'node:tls', 'node:path', 'node:stream'];

const browserEsm = await readFile(new URL('../../dist/browser.esm.js', import.meta.url), 'utf8');
const browserCjs = await readFile(new URL('../../dist/browser.cjs', import.meta.url), 'utf8');

for (const moduleName of forbiddenModules) {
  assert.ok(!browserEsm.includes(moduleName), `browser ESM output resolves ${moduleName}`);
  assert.ok(!browserCjs.includes(moduleName), `browser CommonJS output resolves ${moduleName}`);
}
assert.ok(!browserEsm.includes('importFromCsvFile'));
assert.ok(!browserEsm.includes('exportToCsvFile'));

const browserEsmExports = await import('@exasol/exasol-driver-ts/browser');
const browserCjsExports = require('@exasol/exasol-driver-ts/browser');
const nodeEsmExports = await import('@exasol/exasol-driver-ts');
const nodeCjsExports = require('@exasol/exasol-driver-ts');

for (const browserExports of [browserEsmExports, browserCjsExports]) {
  const driver = new browserExports.ExasolDriver(factory, { accessToken: 'access-token' });
  new browserExports.ExasolPool(factory, { accessToken: 'access-token' });
  assert.equal('importFromCsvFile' in driver, false);
  assert.equal('exportToCsvFile' in driver, false);
}

for (const nodeExports of [nodeEsmExports, nodeCjsExports]) {
  const driver = new nodeExports.ExasolDriver(factory, { accessToken: 'access-token' });
  new nodeExports.ExasolPool(factory, { accessToken: 'access-token' });
  assert.equal(typeof driver.importFromCsvFile, 'function');
  assert.equal(typeof driver.exportToCsvFile, 'function');
}
