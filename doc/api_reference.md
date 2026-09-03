# Exasol TypeScript / JavaScript Driver

The Exasol driver lets Node.js and browser applications connect to Exasol and execute SQL.

[GitHub repository](https://github.com/exasol/exasol-driver-ts) · [User guide](https://github.com/exasol/exasol-driver-ts/blob/main/doc/user_guide/user_guide.md)

## Main API

- {@link ExasolDriver} — create a database connection and execute SQL.
- {@link ExasolPool} — manage a pool of database connections.
- {@link Config} — configure the driver connection.
- {@link IExasolDriver} — Node.js driver operations exposed by `ExasolDriver`, including CSV file operations.
- {@link IExasolClient} — browser-safe driver operations.
- {@link IStatement} — execute and close prepared statements.

## Quick Start

Install the driver:

```sh
npm install @exasol/exasol-driver-ts
```

Connect, execute a query, and close the driver when finished:

```ts
import { ExasolDriver } from '@exasol/exasol-driver-ts';

const driver = new ExasolDriver({ host: 'localhost', port: 8563, user: 'sys', password: 'exasol' });

await driver.connect();
await driver.query('SELECT * FROM EXA_ALL_SCHEMAS');
await driver.close();
```

For browser applications, import the browser-safe entry point. It uses the browser-native `WebSocket` by default and does not provide Node.js CSV file operations:

```ts
import { ExasolDriver } from '@exasol/exasol-driver-ts/browser';
```
