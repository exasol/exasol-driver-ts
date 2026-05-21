# Context and Scope

This chapter describes the technical context, neighboring systems, external interfaces, and system boundary.

Terms use the definitions from [System Requirements](../system_requirements.md).

## System Boundary

The system is the npm package `@exasol/exasol-driver-ts`. It includes the TypeScript source, compiled JavaScript library, public type declarations, connection handling, SQL command objects, result conversion, connection pooling, logging helpers, error reporting, and Node.js CSV import support.

Outside the system are the application using the library, the Exasol database, the runtime WebSocket implementation, the local CSV files imported by Node.js applications, npm, CI infrastructure, and the operating system.

## Users and Neighboring Systems

* Application developer using the public TypeScript or JavaScript API.
* Browser application running in a browser runtime that provides native `WebSocket`.
* Node.js application running in a Node.js runtime that provides a compatible WebSocket implementation such as `ws` and access to local files for CSV import.
* Exasol database server accepting WebSocket SQL protocol connections.
* Local filesystem for Node.js CSV import.
* npm package registry for distribution.
* GitHub Actions and SonarCloud for build and quality feedback.

## Supported Environment

The core driver and pool are intended for browser and Node.js runtimes. Tests exercise Node.js and jsdom environments. CSV import is supported only in Node.js.

## External Interfaces

The main public APIs are exported from `src/index.ts`:

* `ExasolDriver`
* `ExasolPool`
* `ExaWebsocket`
* SQL command and response types
* `QueryResult`
* logger types
* CSV import option types

The driver communicates with Exasol through WebSocket URLs based on `host`, `port`, `url`, and `encryption` configuration. CSV import additionally uses an Exasol import tunnel and generates an `IMPORT INTO ... FROM CSV` SQL statement.

## State and Persistence

The driver keeps in-memory connection state, pool state, command activity state, logger configuration, and result data while operations are running. It does not persist configuration or query results. CSV import reads local files but does not write local data. The library does not implement telemetry.

## Explicit Non-Goals

* The library does not provide a database server or start Exasol.
* The library does not own credential storage.
* The library does not provide browser CSV import.
* The library does not parse SQL statements.
* The library does not manage schema migrations.

## Open Issues

* Browser support level is described generally, but exact browser versions are not specified.
