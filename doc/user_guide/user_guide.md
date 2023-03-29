## User Guide

### NodeJS

Install the following dependencies from the [npm](https://www.npmjs.com/) package registry

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

### Browser

Install the following dependencies from the [npm](https://www.npmjs.com/) package registry

```bash
npm install -S @exasol/exasol-driver-ts
```

Connecting to the database:

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

### Further examples

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

### Supported Driver Properties

| Property           |       Value        |       Default       | Description                                                                                                                             |
| :----------------- | :----------------: | :-----------------: | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `host`             |       string       |     'localhost'     | Host name or ip address.                                                                                                                |
| `port`             |       number       |        8563         | Port number.                                                                                                                            |
| `user`             |       string       |                     | Exasol username.                                                                                                                        |
| `password`         |       string       |                     | Exasol password.                                                                                                                        |
| `autocommit`       | false=off, true=on |        true         | Switch autocommit on or off.                                                                                                            |
| `clientName`       |       string       | 'Javascript client' | Tell the server the application name.                                                                                                   |
| `clientVersion`    |       string       |          1          | Tell the server the version of the application.                                                                                         |
| `encryption`       | false=off, true=on |        true         | Switch automatic encryption on or off.                                                                                                  |
| `fetchSize`        |     number, >0     |     `128*1024`      | Amount of data in kB which should be obtained by Exasol during a fetch. The application can run out of memory if the value is too high. |
| `resultSetMaxRows` |       number       |                     | Set the max amount of rows in the result set.                                                                                           |
| `schema`           |       string       |                     | Exasol schema name.                                                                                                                     |
