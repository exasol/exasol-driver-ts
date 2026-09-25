/* eslint-disable @typescript-eslint/no-require-imports -- This helper runs from CommonJS consumer fixtures. */
const crypto = require('node:crypto');

class FakeSocket {
  constructor(onExecute) {
    this.onExecute = onExecute;
    this.readyState = 0;
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.({});
    });
  }

  send(data) {
    const command = JSON.parse(data);
    void this.reply(command);
  }

  async reply(command) {
    let response;
    if (command.command === 'login') {
      response = loginKeyResponse();
    } else if (command.command === 'execute') {
      await this.onExecute?.();
      response = rowCountResponse();
    } else if ('username' in command) {
      response = sessionResponse();
    } else {
      response = { status: 'ok', responseData: {} };
    }
    queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(response) }));
  }

  close() {
    this.readyState = 3;
  }
}

const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const hex = (base64url) => Buffer.from(base64url, 'base64url').toString('hex');

function loginKeyResponse() {
  return {
    status: 'ok',
    responseData: {
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
      publicKeyModulus: hex(jwk.n),
      publicKeyExponent: hex(jwk.e),
    },
  };
}

function sessionResponse() {
  return {
    status: 'ok',
    responseData: {
      sessionId: 1,
      protocolVersion: 3,
      releaseVersion: '8.32.0',
      databaseName: 'db',
      productName: 'EXASolution',
      maxDataMessageSize: 67108864,
      maxIdentifierLength: 128,
      maxVarcharLength: 2000000,
      identifierQuoteString: '"',
      timeZone: 'UTC',
      timeZoneBehavior: 'INVALID',
    },
  };
}

function rowCountResponse() {
  return {
    status: 'ok',
    responseData: { numResults: 1, results: [{ resultType: 'rowCount', rowCount: 3 }] },
  };
}

async function connectWithBasicAuth(ExasolDriver) {
  const driver = new ExasolDriver(() => new FakeSocket(), { host: 'fake', port: 8563, user: 'user', password: 'password' });
  await driver.connect();
  return driver;
}

async function verifyNodeEntry(ExasolDriver) {
  const driver = await connectWithBasicAuth(ExasolDriver);
  try {
    if (typeof driver.importFromCsvFile !== 'function' || typeof driver.importFromParquetFile !== 'function' || typeof driver.exportToCsvFile !== 'function') {
      throw new Error('The Node.js package entry point does not expose local file APIs.');
    }
  } finally {
    await driver.close();
  }
}

module.exports = { connectWithBasicAuth, verifyNodeEntry };
