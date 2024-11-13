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

### Pool

As of version 0.2.0 we now also provide a connection pool called `ExasolPool`.

#### NPM packages

Install the following dependencies from the [npm](https://www.npmjs.com/) package registry:

NodeJS:

```bash
npm install --save @exasol/exasol-driver-ts ws @types/ws
```

Browser:

```bash
npm install --save @exasol/exasol-driver-ts
```

#### Creating a connection pool:

NodeJs:

```js
import { ExaWebsocket, ExasolPool } from "@exasol/exasol-driver-ts";
import { WebSocket } from 'ws';

const pool = new ExasolPool((url) => {
  return new WebSocket(url) as ExaWebsocket;
}, {
  host: 'localhost',
  port: 8563,
  user: 'sys',
  password: 'exasol',
  encryption: false,
  minimumPoolSize: 1,
  maximumPoolSize: 10,
});
```

Browser:

```js
import { ExasolDriver,ExaWebsocket } from '@exasol/exasol-driver-ts';

const pool = new ExasolPool((url) => {
  return new WebSocket(url) as ExaWebsocket;
}, {
  host: 'localhost',
  port: 8563,
  user: 'sys',
  password: 'exasol',
  encryption: false,
  minimumPoolSize: 1,
  maximumPoolSize: 10,
});
```

The configuration is very similar to the `ExasolDriver` (client). With the added `minimumPoolSize` and `maximumPoolSize` options you can specify the minimum and maximum number of active connections in the pool. Defaults are 0 (minimumPoolSize) and 5 (maximumPoolSize).

#### Runninq a query

```js
const queryResult = await pool.query('SELECT x FROM SCHEMANAME.TABLENAME');
```

#### Clearing the pool

Draining and clearing the pool (do this when you don't need the pool anymore or before exiting the application):

```js
await pool.drain();
await pool.clear();
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
| `minimumPoolSize`  |       number       |          0          | Minimum amount of active connections.                                                                                                   |
| `maximumPoolSize`  |       number       |          5          | Maximum amount of active connections.                                                                                                   |
