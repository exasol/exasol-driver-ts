/* eslint-disable @typescript-eslint/no-require-imports -- This fixture verifies the CommonJS export condition. */
const { ExasolDriver } = require('@exasol/exasol-driver-ts');
const { verifyNodeEntry } = require('./support.cjs');

// [itest->dsn~decision-publish-cjs-and-esm~3]
// [itest->dsn~runtime-connect-basic-authentication~1]
void verifyNodeEntry(ExasolDriver);
