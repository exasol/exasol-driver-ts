import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const forbiddenModules = ['node:fs', 'node:net', 'node:tls', 'node:path', 'node:stream'];

const browserEsm = await readFile(new URL('../../dist/browser.esm.js', import.meta.url), 'utf8');
const browserCjs = await readFile(new URL('../../dist/browser.cjs', import.meta.url), 'utf8');

for (const moduleName of forbiddenModules) {
  assert.ok(!browserEsm.includes(moduleName), `browser ESM output resolves ${moduleName}`);
  assert.ok(!browserCjs.includes(moduleName), `browser CommonJS output resolves ${moduleName}`);
}
assert.ok(!browserEsm.includes('importFromCsvFile'));
assert.ok(!browserEsm.includes('importFromParquetFile'));
assert.ok(!browserEsm.includes('exportToCsvFile'));

const browserDeclarations = await readFile(new URL('../../dist/browser.d.ts', import.meta.url), 'utf8');
for (const match of browserDeclarations.matchAll(/(?:from\s*|import\()\s*['"](\.\.?\/[^'"]+)['"]/g)) {
  assert.ok(match[1].endsWith('.js'), `browser.d.ts contains an extensionless relative specifier: ${match[1]}`);
}

const require = createRequire(import.meta.url);

const browserEsmExports = await import('@exasol/exasol-driver-ts/browser');
const browserCjsExports = require('@exasol/exasol-driver-ts/browser');
const fakeWebSocketFactory = () => ({});
for (const browserExports of [browserEsmExports, browserCjsExports]) {
  const driver = new browserExports.ExasolDriver(fakeWebSocketFactory, { accessToken: 'access-token' });
  new browserExports.ExasolPool(fakeWebSocketFactory, { accessToken: 'access-token' });
  assert.equal('importFromCsvFile' in driver, false);
  assert.equal('exportToCsvFile' in driver, false);
}
