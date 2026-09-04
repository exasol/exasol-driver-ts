# Exasol TypeScript / JavaScript Driver

The Exasol driver lets Node.js and browser applications connect to Exasol and execute SQL.

[GitHub repository](https://github.com/exasol/exasol-driver-ts) · [User guide](https://github.com/exasol/exasol-driver-ts/blob/main/doc/user_guide/user_guide.md)

## Main API

- {@link !index.ExasolDriver | ExasolDriver} — Node.js driver that creates a database connection and executes SQL.
- {@link !index.ExasolPool | ExasolPool} — Node.js pool that manages database connections.
- {@link !browser.ExasolDriver | Browser ExasolDriver} — browser-safe driver that creates a database connection and executes SQL.
- {@link !browser.ExasolPool | Browser ExasolPool} — browser-safe pool that manages database connections.
- {@link !index.Config | Config} — configure the driver connection.
- {@link !index.IExasolDriver | IExasolDriver} — Node.js driver operations exposed by `ExasolDriver`, including CSV file operations.
- {@link !index.IExasolClient | IExasolClient} — browser-safe driver operations.
- {@link !index.IStatement | IStatement} — execute and close prepared statements.

## Entry points

Use the package root in Node.js. It includes Node.js CSV import and export operations:

```ts
import { ExasolDriver, ExasolPool } from '@exasol/exasol-driver-ts';
```

Use the `/browser` subpath in browser applications. It excludes Node.js CSV file operations:

```ts
import { ExasolDriver, ExasolPool } from '@exasol/exasol-driver-ts/browser';
```

Both entry points require a WebSocket factory as the first constructor argument.

## Quick Start

Install the driver:

```sh
npm install @exasol/exasol-driver-ts
```

Connect, execute a query, and close the driver when finished:

The example assumes `websocketFactory` is a compatible factory for the selected runtime.

```ts
import { ExasolDriver } from '@exasol/exasol-driver-ts';

const driver = new ExasolDriver(websocketFactory, { host: 'localhost', port: 8563, user: 'sys', password: 'exasol' });

await driver.connect();
await driver.query('SELECT * FROM EXA_ALL_SCHEMAS');
await driver.close();
```
