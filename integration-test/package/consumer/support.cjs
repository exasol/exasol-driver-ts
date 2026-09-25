/* eslint-disable @typescript-eslint/no-require-imports -- This helper runs from CommonJS consumer fixtures. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { WebSocket } = require('ws');

const config = {
  host: requiredEnvironment('EXASOL_HOST'),
  port: Number(requiredEnvironment('EXASOL_PORT')),
  user: 'sys',
  password: 'exasol',
};
const ca = Buffer.from(requiredEnvironment('EXASOL_CA_BASE64'), 'base64').toString();

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createDriver(ExasolDriver) {
  const websocketFactory = (url) => new WebSocket(url, { rejectUnauthorized: true, ca, checkServerIdentity: () => undefined });
  return new ExasolDriver(websocketFactory, config);
}

async function verifyNodeEntry(ExasolDriver) {
  const driver = createDriver(ExasolDriver);
  const schema = `PACKAGE_TEST_${randomUUID().replace(/-/g, '')}`;
  const directory = await mkdtemp(join(tmpdir(), 'exasol-driver-package-'));
  try {
    await driver.connect();
    assert.equal(typeof driver.importFromCsvFile, 'function');
    await driver.execute(`CREATE SCHEMA ${schema}`);
    await driver.execute(`CREATE TABLE ${schema}.CSV_IMPORT (ID DECIMAL(18,0), NAME VARCHAR(20))`);
    const filePath = join(directory, 'input.csv');
    await writeFile(filePath, '1,one\n2,two\n');
    assert.equal(await driver.importFromCsvFile(`${schema}.CSV_IMPORT`, filePath), 2);
    assert.deepEqual((await driver.query(`SELECT * FROM ${schema}.CSV_IMPORT ORDER BY ID`)).getRows(), [
      { ID: 1, NAME: 'one' },
      { ID: 2, NAME: 'two' },
    ]);
  } finally {
    await driver.execute(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => undefined);
    await driver.close().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
}

async function verifyBrowserEntry(ExasolDriver) {
  const driver = createDriver(ExasolDriver);
  try {
    await driver.connect();
    assert.equal('importFromCsvFile' in driver, false);
    assert.deepEqual((await driver.query('SELECT 1 AS X')).getRows(), [{ X: 1 }]);
  } finally {
    await driver.close().catch(() => undefined);
  }
}

module.exports = { verifyBrowserEntry, verifyNodeEntry };
