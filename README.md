# Exasol Driver

## Usage

### NodeJS

```bash
npm install -S @exasol/exasol-driver-ts ws @types/ws
```

```js
import { ExasolDriver,ExaWebsocket } from '@exasol/exasol-driver-ts';
import { WebSocket } from 'ws';

const driver = new ExasolDriver((url) => {
      return new WebSocket(url) as ExaWebsocket;
    }, {
        host: "localhost",
        port: 8563,
        user: 'sys',
        password: 'exasol',
        encryption: false,
    });

await driver.connect();
await driver.query("SELECT * FROM EXA_ALL_SCHEMAS")
await driver.close();
```

### Browser

```bash
npm install -S @exasol/exasol-driver-ts
```

```js
import { ExasolDriver,ExaWebsocket } from '@exasol/exasol-driver-ts';

const driver = new ExasolDriver((url) => {
      return new WebSocket(url) as ExaWebsocket;
    }, {
        host: "localhost",
        port: 8563,
        user: 'sys',
        password: 'exasol',
        encryption: false,
    });

await driver.connect();
await driver.query("SELECT * FROM EXA_ALL_SCHEMAS")
await driver.close();
```

### Example create table and read data

```js
const driver = await openConnection(factory, container);
const schemaName = 'TEST';
await driver.execute('CREATE SCHEMA ' + schemaName);
await driver.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
await driver.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');
const queryResult = await driver.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

console.log(queryResult.getColumns());
/*
[
  { name: 'X', dataType: { type: 'DECIMAL', precision: 18, scale: 0 } }
]
*/

console.log(queryResult.getRows());
/*
 [ { X: 15 } ]
*/
```

## Development

### Requirements

- NodeJS
- Docker

### Lint

```bash
npm run lint // Will autofix issues
npm run lint:ci // No autofix enabled
```

### Unit test

```bash
 npm run test // Runs both test in parallel
 npm run test:dom
 npm run test:node
```

### Integration test

```bash
 npm run itest // Runs both test in parallel
 npm run itest:dom
 npm run itest:node
```

#### MacOS

If you using Docker Desktop, please set

```bash
export DOCKER_HOST=unix:///Users/$(whoami)/Library/Containers/com.docker.docker/Data/docker.raw.sock
```
