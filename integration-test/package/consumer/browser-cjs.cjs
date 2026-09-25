/* eslint-disable @typescript-eslint/no-require-imports -- This fixture verifies the CommonJS export condition. */
const assert = require('node:assert/strict');
const { ExasolDriver } = require('@exasol/exasol-driver-ts/browser');
const { connectWithBasicAuth } = require('./support.cjs');

// [itest->dsn~runtime-packaging~2]
// [itest->dsn~runtime-connect-basic-authentication~1]
void connectWithBasicAuth(ExasolDriver).then(async (driver) => {
  assert.equal('importFromCsvFile' in driver, false);
  await driver.close();
});
