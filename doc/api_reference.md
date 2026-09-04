# Exasol TypeScript / JavaScript Driver

The Exasol driver lets Node.js and browser applications connect to Exasol and execute SQL.

## Entry Points

Use `@exasol/exasol-driver-ts` in Node.js for the complete API, including local CSV import and export. Use `@exasol/exasol-driver-ts/browser` in browser applications; it exports the driver and pool core without Node.js CSV or TLS modules. Both entry points require an explicit WebSocket factory.

[GitHub repository](https://github.com/exasol/exasol-driver-ts) · [User guide](https://github.com/exasol/exasol-driver-ts/blob/main/doc/user_guide/user_guide.md)

## Main API

- {@link ExasolDriver} — create a database connection and execute SQL.
- {@link ExasolPool} — manage a pool of database connections.
- {@link Config} — configure the driver connection.
- {@link IExasolDriver} — driver operations exposed by `ExasolDriver`.
- {@link IStatement} — execute and close prepared statements.

## Quick Start

Install the driver and the Node.js WebSocket implementation:

```sh
npm install @exasol/exasol-driver-ts ws @types/ws
```

Connect, execute a query, and close the driver when finished:

```ts
import { ExasolDriver, ExaWebsocket } from '@exasol/exasol-driver-ts';
import { WebSocket } from 'ws';

const driver = new ExasolDriver(
  (url) => new WebSocket(url) as ExaWebsocket,
  { host: 'localhost', port: 8563, user: 'sys', password: 'exasol' },
);

await driver.connect();
await driver.query('SELECT * FROM EXA_ALL_SCHEMAS');
await driver.close();
```
