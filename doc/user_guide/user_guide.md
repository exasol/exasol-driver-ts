## User Guide

### Introduction

`@exasol/exasol-driver-ts` supports both browser and Node.js runtimes. Use the package root `@exasol/exasol-driver-ts` in Node.js. In browser applications use `@exasol/exasol-driver-ts/browser`.

For the complete public API, see the [API reference](https://exasol.github.io/exasol-driver-ts/api/).

Both entry points require an explicit WebSocket factory. In a browser, use the runtime-native `WebSocket`; in Node.js, provide a compatible implementation such as `ws`. The browser entry excludes the Node.js-only local file import and export APIs.

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

### Connecting to a Cluster With Multiple Hosts

The `host` property accepts an Exasol connection string, using the same syntax as the other Exasol drivers:

```
host[..range][/fingerprint][:port][,host[..range][/fingerprint][:port]...]
```

<!-- [uman->scn~connection-string-hosts-expanded~1] -->
* A range expands the last number of a host name: `10.0.0.10..12` means `10.0.0.10`, `10.0.0.11` and `10.0.0.12`; `exasol1..3.example.com` means `exasol1.example.com` to `exasol3.example.com`. Leading zeros are kept (`node08..10`).
* Separate several hosts or ranges with commas: `exasol1..3,exasol10`.
* Host names may contain letters, digits, `.`, `-` and `_`.
* Enclose IPv6 addresses in brackets: `[2001:db8::1]:8563`.
* A connection string may expand to at most 10000 hosts.
* A port in the connection string takes precedence over the `port` property. It applies to its own part and all preceding parts without a port, so `exasol1,exasol2:8564` uses port 8564 for both hosts.
* A fingerprint selects which server certificate the driver accepts, see [Server Certificate Validation](#server-certificate-validation). Like a port, it applies to its own part and all preceding parts without a fingerprint.

<!-- [uman->scn~connection-string-failover~1] -->
The driver tries the hosts in random order to spread the load across the cluster. If the WebSocket to a host cannot be opened, it tries the next host. Errors after the WebSocket is open, such as wrong credentials, are not retried on other hosts. If no host can be reached, `connect()` rejects with an error that lists every host and its cause. `ExasolPool` behaves the same way for each pooled connection.

```ts
const driver = new ExasolDriver((url) => new WebSocket(url) as ExaWebsocket, {
  host: '10.0.0.10..12:8563',
  user: 'sys',
  password: 'exasol',
  connectTimeout: 5000,
});
```

<!-- [uman->scn~connection-string-connect-timeout~1] -->
`connectTimeout` limits how long the driver waits for the WebSocket to a single host to open before it tries the next host, and separately how long it waits for the login. A login that times out is not retried on another host. The default is 20000 ms; `0` disables the timeout.

When the `url` property is set, the driver uses that URL and does not parse `host` as a connection string. Local file import and export then connect to the `host` and `port` properties.

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

A prepared statement keeps its connection until it is closed, also when `execute()` fails. If you don't use `await using`, call `close()` in a `finally` block.

`statement.execute()` returns the full Exasol response. If Exasol rejects the statement, the response has `status` `'error'` and the error details are in `exception`. If fetching the result rows fails, `execute()` rejects with the error instead.

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

### Server Certificate Validation

The driver supports the same three ways of checking the server certificate as the other Exasol drivers:

| Mode                    | Accepts                                                                     | Configuration                                                       |
|-------------------------|-----------------------------------------------------------------------------|---------------------------------------------------------------------|
| Validate (default)      | A certificate from a trusted certificate authority that matches the host name | Default                                                           |
| Fingerprint             | Only the certificate with the given SHA-256 fingerprint                     | `host/<fingerprint>` in the connection string                       |
| No validation           | Any certificate                                                             | `validateServerCertificate: false`, or `host/nocertcheck`           |

The driver passes the result to your WebSocket factory as second argument, `{ rejectUnauthorized }`. Forward it to `ws`, so that the factory works for all modes:

```ts
import { ExasolDriver, ExaWebsocket, WebsocketFactory } from '@exasol/exasol-driver-ts';
import { WebSocket } from 'ws';

const websocketFactory: WebsocketFactory = (url, options) =>
  new WebSocket(url, { rejectUnauthorized: options?.rejectUnauthorized ?? true }) as ExaWebsocket;
```

A factory that ignores the options keeps the TLS settings it sets itself. With the `ws` defaults it always validates the certificate, so fingerprints of self-signed certificates and `validateServerCertificate: false` then fail with a certificate error. A factory that hard-codes `rejectUnauthorized: false` accepts any certificate in every mode, without the driver's warning. Remove such a setting and pass on `options.rejectUnauthorized` instead.

<!-- [uman->scn~untrusted-server-certificate-reported~1] -->
If Node.js does not trust the server certificate in the default mode, for example because it is self-signed, the connection fails with error `E-EDJS-49`. The error names the host and the TLS error, and suggests adding the certificate fingerprint to the connection string, as described below.

#### Certificate Fingerprint

<!-- [uman->scn~connection-string-fingerprint-validated~1] -->
Add the SHA-256 fingerprint of the server certificate after the host name to accept only this certificate, for example for Exasol SaaS private endpoints or clusters with self-signed certificates. The driver then skips the certificate authority and host name checks. The fingerprint is the hexadecimal SHA-256 hash of the certificate: 64 characters, upper or lower case. The driver rejects fingerprints of another length, such as truncated or SHA-1 fingerprints, with error `E-EDJS-48` before connecting. You can compute it with:

```sh
openssl s_client -connect exasol.example.com:8563 </dev/null 2>/dev/null | openssl x509 -noout -fingerprint -sha256 | sed 's/.*=//; s/://g'
```

```ts
const driver = new ExasolDriver(websocketFactory, {
  host: 'exasol1..3.example.com/A1B2C3...:8563',
  user: 'sys',
  password: 'exasol',
});
```

<!-- [uman->scn~fingerprint-mismatch-rejected~1] -->
The driver checks the fingerprint after the TLS handshake and before it sends credentials or any Exasol command. Only the WebSocket upgrade request, including headers your factory adds, has been sent at that point. If the server presents a different certificate, `connect()` rejects with error `E-EDJS-46`, which shows both fingerprints, and the driver does not try other hosts. Fingerprints are only supported in Node.js, and the factory must return a `ws` WebSocket, because other implementations do not expose the server certificate. If the WebSocket does not expose it, the driver closes the WebSocket and reports `E-EDJS-47` for that host.

#### Disabling Validation

<!-- [uman->scn~server-certificate-validation-disabled~1] -->
`validateServerCertificate: false` accepts any server certificate for all hosts without a fingerprint, and the fingerprint `nocertcheck` does the same for its hosts. The driver logs a warning, because such connections are vulnerable to man-in-the-middle attacks. Like all driver messages, the warning goes to the logger passed as third constructor argument, for example `new Logger(LogLevel.Warn)`; the default logger is off. The driver also warns when your factory does not declare the options parameter, because it then probably ignores `rejectUnauthorized`. Prefer a fingerprint, and use these options instead of disabling certificate validation for the whole process with `NODE_TLS_REJECT_UNAUTHORIZED=0`.

#### Trusting a Self-signed Certificate Authority

Instead of a fingerprint, you can configure `ws` with the certificate authority (CA) of a self-signed certificate. Keep certificate validation enabled and disable hostname verification only when the certificate's hostname does not match the host used for the connection.

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

When the certificate hostname matches the configured host, omit `checkServerIdentity` so that Node verifies it as well.

#### Browsers

<!-- [uman->scn~certificate-modes-unsupported-in-browsers~1] -->
Browsers do not expose the server certificate and do not allow skipping its validation. The browser entry point therefore only supports the default validation and rejects fingerprints and `validateServerCertificate: false` with error `E-EDJS-45`.

### Browser

<!-- [uman->scn~browser-connection-uses-native-websocket~2] -->

Install the following dependencies from the [npm](https://www.npmjs.com/) package registry

```sh
npm install --save @exasol/exasol-driver-ts
```

Connecting to the database:

```ts
import { ExasolDriver,ExaWebsocket } from '@exasol/exasol-driver-ts/browser';

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

### Parquet Import
<!-- [uman->scn~parquet-import-succeeds~1] -->

Parquet import with `importFromParquetFile()` is only available in Node.js and requires Exasol 2025.1.9 or later. The driver streams the original local Parquet file to the database.

The optional third argument is reserved for Parquet import options and is currently empty. Pass `undefined` when supplying import control options as the fourth argument.

```ts
const importedRows = await driver.importFromParquetFile(
  'MY_SCHEMA.MY_TABLE',
  '/absolute/path/to/data.parquet',
);
```

#### Cancelling a Running Parquet Import
<!-- [uman->scn~parquet-import-is-cancelled~1] -->

Pass an `AbortSignal` as the optional fourth argument to stop an in-flight Parquet import. The promise rejects with an `AbortError` and releases its file and tunnel resources.

```ts
const controller = new AbortController();
const importPromise = driver.importFromParquetFile(
  'MY_SCHEMA.MY_TABLE',
  '/absolute/path/to/data.parquet',
  undefined,
  { signal: controller.signal },
);

controller.abort();
await importPromise;
```

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
| `host`             |       string       |     'localhost'     | Host name, IP address or connection string, see [Connecting to a Cluster With Multiple Hosts](#connecting-to-a-cluster-with-multiple-hosts). |
| `port`             |       number       |        8563         | Port number. A port in the connection string in `host` takes precedence.                                                                 |
| `url`              |       string       |                     | WebSocket URL that replaces `wss://<host>:<port>`. `host` is not parsed as a connection string when set.                                 |
| `connectTimeout`   |    number, >=0     |        20000        | Time in milliseconds to wait for the WebSocket to a single host to open before trying the next host, and separately for the login. `0` disables the timeout. |
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
| `validateServerCertificate` | false=off, true=on | true       | Validate the server certificate against trusted certificate authorities and the host name. `false` accepts any certificate and logs a warning (with a logger at level `Warn` or higher); a fingerprint in the connection string takes precedence. `false` is only supported in Node.js. See [Server Certificate Validation](#server-certificate-validation). |
<!-- [uman->scn~configured-fetch-size-used-during-fetch~1] -->
| `fetchSize`        |     number, >0     |    `1024*1024`      | Amount of data in bytes which should be obtained by Exasol during a fetch. The application can run out of memory if the value is too high. |
| `resultSetMaxRows` |       number       |                     | Set the max amount of rows in the result set. `0`, a negative value or not set means no limit.                                          |
| `schema`           |       string       |                     | Exasol schema name.                                                                                                                     |
| `onClose`          |      function      |                     | Called when an open WebSocket closes.                                                                                                   |
| `onError`          |      function      |                     | Called on WebSocket errors: when an open WebSocket reports an error, or once per `connect()` when no WebSocket could be opened to any host. Not called for configuration errors such as an invalid connection string. |

### Connection Pool

As of version 0.2.0 we now also provide a connection pool called `ExasolPool`.

#### NPM Packages

Install the following dependencies from the [npm](https://www.npmjs.com/) package registry:

Node.js:

```sh
npm install --save @exasol/exasol-driver-ts ws @types/ws
```

Browser:

```sh
npm install --save @exasol/exasol-driver-ts
```

#### Creating a Connection Pool

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
import { ExaWebsocket, ExasolPool } from '@exasol/exasol-driver-ts/browser';

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

<!-- [uman->scn~pool-query-rejected-when-connection-fails~1] -->
If the pool cannot open a connection, for example because of wrong credentials or unreachable hosts, the query rejects with the connection error. The next query tries to open a connection again. With `minimumPoolSize` set, a failed attempt to refill the pool can also reject a waiting query.

#### Runninq a Query

```ts
const queryResult = await pool.query('SELECT x FROM SCHEMANAME.TABLENAME');
```

#### Clearing the Pool

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
