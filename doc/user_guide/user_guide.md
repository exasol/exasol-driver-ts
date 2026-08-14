## User Guide

### Introduction

`@exasol/exasol-driver-ts` supports both browser and Node.js runtimes.

In a browser, the library uses the native `WebSocket` implementation that is available in the runtime. In Node.js, you need to provide a WebSocket implementation such as the `ws` package when creating the driver or connection pool.

The following sections show the runtime-specific setup for both environments.

### Node.js

Install the following dependencies from the [npm](https://www.npmjs.com/) package registry:

```sh
npm install --save @exasol/exasol-driver-ts ws @types/ws
```

Connecting to the database:

```ts
import { ExasolDriver,ExaWebsocket } from '@exasol/exasol-driver-ts';
import { WebSocket } from 'ws';

const driver = new ExasolDriver((url) => {
      return new WebSocket(url) as ExaWebsocket;
    }, {
        host: "localhost",
        port: 8563,
        user: 'sys',
        password: 'exasol'
    });

// Connect
await driver.connect();
// Execute query
await driver.query("SELECT * FROM EXA_ALL_SCHEMAS");
// Close the connection
await driver.close();
```

### Automatic Resource Cleanup

<!-- [uman->scn~async-dispose-driver~1] -->
With TypeScript 5.2 or later, use `await using` to close drivers, prepared statements, and connection pools automatically when the surrounding scope exits. Enable the `esnext.disposable` TypeScript library declaration in your application if it is not already included by your compiler configuration.

<!-- [uman->scn~async-dispose-prepared-statement~1] -->
Use `await using` for prepared statements so their server-side handle and connection are released automatically:

```ts
async function runQuery() {
  await using driver = new ExasolDriver(
    (url) => new WebSocket(url) as ExaWebsocket,
    { host: 'localhost', port: 8563, user: 'sys', password: 'exasol' },
  );
  await driver.connect();

  await using statement = await driver.prepare('SELECT * FROM EXA_ALL_SCHEMAS WHERE SCHEMA_NAME = ?');
  await statement.execute('SYS');
} // The statement is closed and the driver connection is closed here.
```

The driver declaration in this example also closes its database connection when the function exits.

<!-- [uman->scn~async-dispose-connection-pool~1] -->
The pool can be managed the same way. Leaving the scope drains it and clears its connections:

```ts
async function runPooledQuery() {
  await using pool = new ExasolPool(
    (url) => new WebSocket(url) as ExaWebsocket,
    { host: 'localhost', port: 8563, user: 'sys', password: 'exasol' },
  );
  await pool.query('SELECT * FROM EXA_ALL_SCHEMAS');
}
```

#### Connecting With a Self-signed Certificate

For an encrypted Exasol connection that uses a self-signed certificate, configure `ws` with that certificate as a trusted certificate authority (CA). Keep certificate validation enabled and disable hostname verification only when the certificate's hostname does not match the host used for the connection.

```ts
import { readFile } from 'node:fs/promises';
import { ExasolDriver, ExaWebsocket } from '@exasol/exasol-driver-ts';
import { WebSocket } from 'ws';

const ca = await readFile('./exasol-ca.pem', 'utf8');

const driver = new ExasolDriver(
  (url) =>
    new WebSocket(url, {
      rejectUnauthorized: true,
      ca,
      // Required only if the certificate hostname differs from `host` below.
      checkServerIdentity: () => false
    }) as ExaWebsocket,
  {
    host: 'localhost',
    port: 8563,
    user: 'sys',
    password: 'exasol'
  }
);

await driver.connect();
```

Do not use `rejectUnauthorized: false`: it accepts any server certificate. When the certificate hostname matches the configured host, omit `checkServerIdentity` so that Node verifies it as well.

### Browser

Install the following dependencies from the [npm](https://www.npmjs.com/) package registry

```sh
npm install --save @exasol/exasol-driver-ts
```

Connecting to the database:

```ts
import { ExasolDriver,ExaWebsocket } from '@exasol/exasol-driver-ts';

const driver = new ExasolDriver((url) => {
      return new WebSocket(url) as ExaWebsocket;
    }, {
        host: "localhost",
        port: 8563,
        user: 'sys',
        password: 'exasol'
    });

await driver.connect();
await driver.query("SELECT * FROM EXA_ALL_SCHEMAS")
await driver.close();
```

### Further examples

Executing a query using the query method:

```ts
//...
// Connect
await driver.connect();
// Execute query
await driver.query('SELECT * FROM EXA_ALL_SCHEMAS');
// Close the connection
await driver.close();
```

Executing a command using the command method (creating a schema, table and inserting some values):

```ts
//...
// Connect
await driver.connect();
const schemaName = 'TEST';
// Execute commands
await driver.execute('CREATE SCHEMA ' + schemaName);
await driver.execute('CREATE TABLE ' + schemaName + '.TEST_TABLE(x INT)');
await driver.execute('INSERT INTO ' + schemaName + '.TEST_TABLE VALUES (15)');
// Close the connection
await driver.close();
```

Running a query and retrieving the results:

```ts
//...
// Connect
await driver.connect();
const schemaName = 'TEST';
// Run the query
const queryResult = await driver.query('SELECT x FROM ' + schemaName + '.TEST_TABLE');

// Print the result
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
// Close the connection
await driver.close();
```

Reading out a specific row and column from the result set:

```ts
const queryResult = await driver.query('...');
// Print out the 0th row, 'X' column value
console.log(queryResult.getRows()[0]['X']);
```

### CSV Import

CSV import with `importFromCsvFile()` is only available in Node.js. It does not work in the browser because the implementation reads a local file from the Node.js runtime and streams it to Exasol.

Importing a local CSV file:

```ts
import { ExasolDriver, ExaWebsocket } from '@exasol/exasol-driver-ts';
import { WebSocket } from 'ws';

const driver = new ExasolDriver((url) => {
  return new WebSocket(url) as ExaWebsocket;
}, {
  host: 'localhost',
  port: 8563,
  user: 'sys',
  password: 'exasol'
});

await driver.connect();

const importedRows = await driver.importFromCsvFile(
  'MY_SCHEMA.MY_TABLE',
  '/absolute/path/to/data.csv',
);

console.log(importedRows);

await driver.close();
```

Importing a CSV file with format options:

```ts
import {
  ExasolDriver,
  ExaWebsocket,
  RowSeparator,
  TrimMode,
} from '@exasol/exasol-driver-ts';
import { WebSocket } from 'ws';

const driver = new ExasolDriver((url) => {
  return new WebSocket(url) as ExaWebsocket;
}, {
  host: 'localhost',
  port: 8563,
  user: 'sys',
  password: 'exasol'
});

await driver.connect();

await driver.importFromCsvFile('MY_SCHEMA.MY_TABLE', '/absolute/path/to/data.csv', {
  columnSeparator: ';',
  skip: 1,
  rowSeparator: RowSeparator.CRLF,
  trim: TrimMode.BOTH,
  null: 'NULL',
});

await driver.close();
```

The optional `csvOptions` argument can be used to configure the CSV format, for example the column separator, row separator, header rows to skip, trimming mode, encoding, or additional NULL representation.

#### Cancelling a Running Import
<!-- [uman->scn~csv-import-is-cancelled~1] -->

To cancel an in-flight import, pass an `AbortSignal` as the fourth argument. Aborting the signal stops the file transfer, closes the import tunnel, and rejects the import promise with an `AbortError`.

```ts
const controller = new AbortController();
const importPromise = driver.importFromCsvFile(
  'MY_SCHEMA.MY_TABLE',
  '/absolute/path/to/data.csv',
  undefined,
  { signal: controller.signal },
);

controller.abort();
await importPromise;
```

#### Available CSV Options

| Option | Type | Default | Description |
| :----- | :--- | :------ | :---------- |
| `columnSeparator` | `string` | `','` | Field separator for the CSV file. |
| `columnDelimiter` | `string` | `'"'` | Field delimiter for CSV fields. |
| `rowSeparator` | `RowSeparator` | `RowSeparator.LF` | Line break used in the CSV file. Supported values are `LF`, `CR`, and `CRLF`. |
| `encoding` | `Encoding` | `'UTF-8'` | Character encoding of the CSV file. |
| `skip` | `number` | `0` | Number of rows to skip before importing data, for example to ignore a header row. |
| `trim` | `TrimMode` | `TrimMode.NONE` | Trimming mode for spaces around CSV field values. Supported values are `NONE`, `LEADING`, `TRAILING`, and `BOTH`. |
| `null` | `string` | not set | Additional literal value that should be interpreted as `NULL` for non-delimited fields. |

See the [Exasol documentation](https://docs.exasol.com/db/latest/sql/import.htm#Usagenotes) for details about these options.

### CSV Export

CSV export is available in Node.js. It writes a new local file and returns the number of exported rows.

<!-- [uman->scn~csv-export-table-succeeds~1] -->
Export a table by passing its optionally schema-qualified name and a destination path that does not yet exist:

```ts
await driver.exportToCsvFile('MY_SCHEMA.MY_TABLE', '/absolute/path/to/data.csv');
```

<!-- [uman->scn~csv-export-query-succeeds~1] -->
To export a query result, pass the `SELECT` statement enclosed in parentheses:

```ts
await driver.exportToCsvFile(
  '(SELECT ID, NAME FROM MY_SCHEMA.MY_TABLE ORDER BY ID)',
  '/absolute/path/to/data.csv',
);
```

<!-- [uman->scn~csv-export-applies-format-options~1] -->
Use the optional third argument to configure the CSV layout. Set `withColumnNames` to include a header row; `columnSeparator`, `columnDelimiter`, `rowSeparator`, `encoding`, and `null` are also supported.

```ts
await driver.exportToCsvFile('MY_SCHEMA.MY_TABLE', '/absolute/path/to/data.csv', {
  columnSeparator: ';',
  rowSeparator: RowSeparator.CRLF,
  withColumnNames: true,
});
```

<!-- [uman->scn~csv-export-rejects-existing-destination~1] -->
The destination path must not already exist. The driver rejects the export before transferring data and leaves an existing file unchanged.

#### Available CSV Export Options

Pass format options as the third argument to `exportToCsvFile()`:

| Option | Type | Default | Description |
| :----- | :--- | :------ | :---------- |
| `columnSeparator` | `string` | `','` | Field separator for the exported CSV file. |
| `columnDelimiter` | `string` | `'"'` | Field delimiter for CSV fields. Use `''` to disable delimiters. |
| `rowSeparator` | `RowSeparator.LF`, `RowSeparator.CR`, or `RowSeparator.CRLF` | `RowSeparator.LF` | Line break between CSV rows. |
| `encoding` | `Encoding` | `'UTF-8'` | Character encoding of the exported CSV file. |
| `null` | `string` | empty string | Representation written for `NULL` values. |
| `withColumnNames` | `boolean` | `false` | Includes column names as the first row. Query headers can contain expressions. |

Pass export control options as the optional fourth argument:

| Option | Type | Default | Description |
| :----- | :--- | :------ | :---------- |
| `signal` | `AbortSignal` | not set | Cancels the export, releases its file and tunnel resources, and removes a partial destination file. |

See the [Exasol EXPORT documentation](https://docs.exasol.com/db/latest/sql/export.htm) for format-option details.

<!-- [uman->scn~csv-export-compressed-file-succeeds~1] -->
Exporting to a destination ending in `.zip`, `.gz`, or `.bz2` asks Exasol to create a ZIP, GZIP, or BZIP2-compressed CSV file. The driver writes the compressed bytes directly to that new file; use a destination without one of these extensions for an uncompressed CSV export.

```ts
await driver.exportToCsvFile('MY_SCHEMA.MY_TABLE', '/absolute/path/to/data.csv.gz');
```

<!-- [uman->scn~csv-export-is-cancelled~1] -->
To cancel an in-flight export, pass an `AbortSignal` as the fourth argument. Aborting the signal stops the transfer, removes the partial destination file, and rejects the export promise with an `AbortError`.

```ts
const controller = new AbortController();
const exportPromise = driver.exportToCsvFile(
  'MY_SCHEMA.MY_TABLE',
  '/absolute/path/to/data.csv',
  undefined,
  { signal: controller.signal },
);

controller.abort();
await exportPromise;
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
<!-- [uman->scn~login-metadata-sent-during-login~1] -->
| `clientOs`         |       string       | platform dependent  | Tell the server the client operating system. Defaults to platform and architecture in Node.js, or available browser platform data. |
| `clientOsUsername` |       string       | platform dependent  | Tell the server the operating-system username. Defaults to the available Node.js environment username; browsers do not provide a value. |
| `clientRuntime`    |       string       | platform dependent  | Tell the server the client runtime. Defaults to the Node.js version or the browser user-agent string.                                  |
| `encryption`       | false=off, true=on |        true         | Switch automatic encryption on or off. This property is deprecated and no longer has an effect. Encryption is always on.                |
| `compression`      | false=off, true=on |       false        | Switch compression on or off.                                                                                                           |
<!-- [uman->scn~configured-fetch-size-used-during-fetch~1] -->
| `fetchSize`        |     number, >0     |    `1024*1024`      | Amount of data in bytes which should be obtained by Exasol during a fetch. The application can run out of memory if the value is too high. |
| `resultSetMaxRows` |       number       |                     | Set the max amount of rows in the result set.                                                                                           |
| `schema`           |       string       |                     | Exasol schema name.                                                                                                                     |

### Pool

As of version 0.2.0 we now also provide a connection pool called `ExasolPool`.

#### NPM packages

Install the following dependencies from the [npm](https://www.npmjs.com/) package registry:

Node.js:

```sh
npm install --save @exasol/exasol-driver-ts ws @types/ws
```

Browser:

```sh
npm install --save @exasol/exasol-driver-ts
```

#### Creating a connection pool:

Node.js:

```ts
import { ExaWebsocket, ExasolPool } from "@exasol/exasol-driver-ts";
import { WebSocket } from 'ws';

const pool = new ExasolPool((url) => {
  return new WebSocket(url) as ExaWebsocket;
}, {
  host: 'localhost',
  port: 8563,
  user: 'sys',
  password: 'exasol',
  minimumPoolSize: 1,
  maximumPoolSize: 10,
});
```

Browser:

```ts
import { ExasolDriver,ExaWebsocket } from '@exasol/exasol-driver-ts';

const pool = new ExasolPool((url) => {
  return new WebSocket(url) as ExaWebsocket;
}, {
  host: 'localhost',
  port: 8563,
  user: 'sys',
  password: 'exasol',
  minimumPoolSize: 1,
  maximumPoolSize: 10,
});
```

The configuration is very similar to the `ExasolDriver` (client). With the added `minimumPoolSize` and `maximumPoolSize` options you can specify the minimum and maximum number of active connections in the pool. Defaults are 0 (minimumPoolSize) and 5 (maximumPoolSize).

#### Runninq a query

```ts
const queryResult = await pool.query('SELECT x FROM SCHEMANAME.TABLENAME');
```

#### Clearing the pool

Draining and clearing the pool (do this when you don't need the pool anymore or before exiting the application):

```ts
await pool.drain();
await pool.clear();
```

#### Supported Driver Properties For Pool

All driver properties listed [above](#supported-driver-properties) also apply to connection pools. Pools additionally support:

| Property           | Value  | Default | Description                              |
| :----------------- | :----: | :-----: | :--------------------------------------- |
| `minimumPoolSize`  | number |    0    | Minimum number of active connections.    |
| `maximumPoolSize`  | number |    5    | Maximum number of active connections.    |
