## User Guide

### NodeJS

Install the following dependencies using npm (Part of nodeJs, [found here](https://nodejs.org/en/download))

```bash
npm install -S @exasol/exasol-driver-ts ws @types/ws
```

Connecting to the database:

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

//connect
await driver.connect();
//execute query
await driver.query("SELECT * FROM EXA_ALL_SCHEMAS");
//close the connection
await driver.close();
```

Executing a query using the query method:

```js
//...
//connect
await driver.connect();
//execute query
await driver.query('SELECT * FROM EXA_ALL_SCHEMAS');
//close the connection
await driver.close();
```

Executing a command using the command method (creating a schema, table and inserting some values):

```js
//...
//connect
await driver.connect();
const schemaName = 'TEST';
//execute commands
await driver.execute('CREATE SCHEMA ' + schemaName);
await driver.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
await driver.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');
//close the connection
await driver.close();
```

Running a query and retrieving the results:

```js
//...
//connect
await driver.connect();
const schemaName = 'TEST';
//run the query
const queryResult = await driver.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

//print the result
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
//close the connection
await driver.close();
```

Reading out a specific row and column from the result set:

```js
const queryResult = await driver.query('...');
//print out the 0th row, 'X' column value
console.log(queryResult.getRows()[0]['X']);
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
