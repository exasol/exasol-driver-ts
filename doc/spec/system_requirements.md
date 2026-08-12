# System Requirements

## Introduction

`@exasol/exasol-driver-ts` is a TypeScript and JavaScript driver for connecting applications to an Exasol database. Applications use the driver to open WebSocket connections, authenticate, execute SQL statements, fetch query results, manage a connection pool, and import local CSV files from Node.js.

The library is published as an npm package and is intended for both browser and Node.js runtimes. Browser applications use the runtime-provided `WebSocket` implementation. Node.js applications provide a compatible WebSocket implementation, for example the `ws` package.

## Goals

* Provide a typed Exasol SQL driver for TypeScript and JavaScript applications.
* Support both browser and Node.js runtimes through an injectable WebSocket factory.
* APIs for connecting, querying, executing commands, and closing connections.
* Support secure database communication by default.
* Provide connection pooling for concurrent workloads.
* Support Node.js CSV file imports into Exasol tables.

## Evidence Base

This specification was reverse-engineered from:

* [User Guide](../user_guide/user_guide.md)
* [README](../../README.md)
* [Developer Guide](../developer_guide/developer_guide.md)
* Public API declarations in `src/index.ts`, `src/lib/sql-client.interface.ts`, `src/lib/sql-client.ts`, and `src/lib/sql-pool.ts`
* CSV import implementation in `src/lib/import/`
* Unit tests in `src/lib/**/*.spec.ts`, `src/lib/**/*.spec.node.ts`, and `src/lib/**/*.spec.dom.ts`
* Integration tests in `integration-test/`

## Notation

This document uses OpenFastTrace specification items to express product features, user requirements, acceptance scenarios, and user-manual guidance. Each specification item has a unique identifier in the form `<artifact-type>~<name>~<revision>`.

In this document, feature items use the artifact type `feat`, user requirements use `req`, and acceptance scenarios use `scn`. Design items under `doc/spec/design/` cover the scenarios with artifact type `dsn`; user-guide items use `uman`. Architecture constraints in `doc/spec/design/constraints.md` use artifact type `constr` and are also covered by `dsn` items.

## Terms and Abbreviations

### Driver

The `ExasolDriver` API that manages one logical Exasol database connection and exposes SQL execution operations.

### Pool

The `ExasolPool` API that manages multiple `ExasolDriver` instances through configurable minimum and maximum pool sizes.

### Query

A SQL statement that returns a result set. The driver exposes query results through `QueryResult`.

### Command

A SQL statement that changes database state or returns a row count. The driver exposes command execution through `execute()`.

### Raw Response

The Exasol protocol response returned without converting it to `QueryResult` or row count.

### WebSocket Factory

A user-provided function that receives the database WebSocket URL and returns an object compatible with the driver's `ExaWebsocket` interface.

### CSV Import

Node.js-only functionality that imports a readable local CSV file into an Exasol table using Exasol's `IMPORT FROM CSV` mechanism.

## User Roles

### Application Developer

A developer who installs the npm package and uses the public TypeScript or JavaScript API in an application.

### Database Operator

A person or automation responsible for providing database host, port, credentials, schema, TLS, and connectivity settings.

## Features

### SQL Connectivity
`feat~sql-connectivity~1`

The driver lets applications connect to Exasol, authenticate, execute SQL, read results, and close the connection.

Needs: req

### Explicit Resource Management
`feat~explicit-resource-management~1`

The driver supports TypeScript explicit resource management for closeable driver resources.

Needs: req

### Runtime Portability
`feat~runtime-portability~1`

The driver supports browser and Node.js applications without hard-wiring one concrete WebSocket implementation.

Needs: req

### Connection Pooling
`feat~connection-pooling~1`

The driver provides a pool API for applications that need multiple reusable database connections.

Needs: req

### CSV File Import
`feat~csv-file-import~1`

The driver lets Node.js applications import local CSV files into Exasol tables.

Needs: req

### CSV File Export
`feat~csv-file-export~1`

The driver lets Node.js applications export Exasol tables or query results to new local CSV files.

Needs: req

### Secure and Configurable Sessions
`feat~secure-configurable-sessions~1`

The driver lets applications configure session behavior including TLS usage, authentication mode, autocommit, compression, schema, client metadata, fetch size, and result row limits.

Needs: req

## User Requirements

### Basic Operaionts

#### Connect to Exasol
`req~connect-to-exasol~1`

The application developer creates a driver with database connection settings, authenticates with credentials or tokens, and establishes a database session.

Covers:
- `feat~sql-connectivity~1`

Needs: scn

#### Execute SQL Queries
`req~execute-sql-queries~1`

The application developer executes a SQL query and retrieves result metadata and rows.

Covers:
- `feat~sql-connectivity~1`

Needs: scn

#### Execute SQL Commands
`req~execute-sql-commands~1`

The application developer executes SQL commands and receives the affected row count.

Covers:
- `feat~sql-connectivity~1`

Needs: scn

#### Receive Raw SQL Responses
`req~receive-raw-sql-responses~1`

The application developer requests raw Exasol protocol responses for queries and commands when the normalized return type is not sufficient, for example to inspect protocol fields such as `status`, `attributes`, or `responseData`.

Covers:
- `feat~sql-connectivity~1`

Needs: scn

#### Use Prepared Statements
`req~use-prepared-statements~1`

The application developer creates prepared statements, executes them with positional values, and closes them.

Covers:
- `feat~sql-connectivity~1`

Needs: scn

#### Cancel Running Work
`req~cancel-running-work~1`

The application developer cancels active database work through the driver.

Covers:
- `feat~sql-connectivity~1`

Needs: scn

#### Automatically Dispose Driver Resources
`req~automatically-dispose-driver-resources~1`

The application developer uses TypeScript `await using` declarations to automatically clean up drivers, prepared statements, and connection pools when leaving scope.

Covers:
- `feat~explicit-resource-management~1`

Needs: scn

### Supported Runtimes

#### Run in Browser
`req~run-in-browser~1`

The application developer uses the package in browser runtimes by supplying a WebSocket factory that returns the runtime-provided `WebSocket` implementation.

Covers:
- `feat~runtime-portability~1`

Needs: scn

#### Run in Node.js
`req~run-in-nodejs~1`

The application developer uses the package in Node.js runtimes by supplying a WebSocket factory that returns a compatible Node.js WebSocket implementation.

Rationale:

This keeps server-side consumers independent from the browser runtime while preserving the same package contract.

Covers:
- `feat~runtime-portability~1`

Needs: scn

### Manage a Connection Pool
`req~manage-connection-pool~1`

The application developer creates a connection pool with configurable minimum and maximum sizes, executes queries through it, drains it, and clears it.

Covers:
- `feat~connection-pooling~1`

Needs: scn

### CSV Import

#### Import Local CSV Files
`req~import-local-csv-files~1`

The Node.js application developer imports a readable local CSV file into a target Exasol table and receives the imported row count.

Covers:
- `feat~csv-file-import~1`

Needs: scn

#### Configure CSV Format
`req~configure-csv-format~1`

The Node.js application developer configures CSV import format options including column separator, column delimiter, row separator, encoding, skipped rows, trimming, and NULL representation.

Covers:
- `feat~csv-file-import~1`

Needs: scn

#### Cancel CSV File Import
`req~cancel-csv-file-import~1`

The Node.js application cancels an in-flight CSV file import through an `AbortSignal` and promptly releases the local file and import-tunnel resources.

Covers:
- `feat~csv-file-import~1`

Needs: scn

### CSV Export

#### Export Local CSV Files
`req~export-local-csv-files~1`

The Node.js application exports an Exasol table or query result to a new local CSV file and receives the exported row count.

Covers:
- `feat~csv-file-export~1`

Needs: scn

#### Configure CSV Export Format
`req~configure-csv-export-format~1`

The Node.js application configures CSV export format options including column separator, column delimiter, row separator, encoding, NULL representation, and column names.

Covers:
- `feat~csv-file-export~1`

Needs: scn

### Encrypt Connections by Default
`req~encrypt-connections-by-default~1`

The application developer uses encrypted WebSocket connections by default.

Covers:
- `feat~secure-configurable-sessions~1`

Needs: scn

### Don't Allow Disabling Encryption
`req~do-not-allow-disabling-encryption~1`

Disabling encryption is not possible.

Rationale:

All supported Exasol versions require encrypted connections. Unecrypted connections are rejected.

Covers:
- `feat~secure-configurable-sessions~1`

Needs: impl

### Configure Session Attributes
`req~configure-session-attributes~1`

The application developer configures session attributes including autocommit, schema, compression, fetch size, result row limit, client name, and client version.

Covers:
- `feat~secure-configurable-sessions~1`

Needs: scn

## Acceptance Scenarios

### Connect With Basic Authentication
`scn~connect-with-basic-authentication~1`

**Given** a configured driver with host, port, user, password, encryption setting, and WebSocket factory
**When** the application calls `connect()`
**Then** the driver opens a WebSocket connection, performs the Exasol login flow, and resolves after the session is authenticated

Covers:
- `req~connect-to-exasol~1`

Needs: dsn

### Reject Missing Credentials
`scn~reject-missing-credentials~1`

**Given** a configured driver without user/password and without access or refresh token
**When** the application calls `connect()`
**Then** the driver rejects the connection attempt with an invalid-credentials error

Covers:
- `req~connect-to-exasol~1`

Needs: dsn

### Query Returns Rows
`scn~query-returns-rows~1`

**Given** an authenticated driver and a SQL statement that returns a result set
**When** the application calls `query()`
**Then** the driver fetches all required result data, closes the remote result set, and returns a `QueryResult` exposing columns and row objects

Covers:
- `req~execute-sql-queries~1`

Needs: dsn

### Execute Returns Row Count
`scn~execute-returns-row-count~1`

**Given** an authenticated driver and a SQL statement that returns a row count
**When** the application calls `execute()`
**Then** the driver returns the row count

Covers:
- `req~execute-sql-commands~1`

Needs: dsn

### Raw Response Requested
`scn~raw-response-requested~1`

**Given** an authenticated driver
**When** the application calls `query()` or `execute()` with `responseType` set to `raw`
**Then** the driver returns the Exasol protocol response instead of converting it to a `QueryResult` or row count

Covers:
- `req~receive-raw-sql-responses~1`

Comment:

A protocol response is the low-level object returned by the Exasol WebSocket API, for example a `SQLResponse<SQLQueriesResponse>` with fields such as `status`, `attributes`, `responseData`, and optional `exception`.

Needs: dsn

### Prepared Statement Execution
`scn~prepared-statement-execution~1`

**Given** an authenticated driver and a SQL statement with parameters
**When** the application prepares the statement, executes it with a value count matching the parameter columns, and closes it
**Then** the driver sends Exasol prepared-statement commands and releases the underlying connection when the statement is closed

Covers:
- `req~use-prepared-statements~1`

Needs: dsn

### Cancel Active Work
`scn~cancel-active-work~1`

**Given** an active database operation
**When** the application calls the provided cancel function or `driver.cancel()`
**Then** the driver sends an Exasol abort query command

Covers:
- `req~cancel-running-work~1`

Needs: dsn

### Automatically Dispose a Driver
`scn~async-dispose-driver~1`

**Given** a connected `ExasolDriver` in an `await using` declaration
**When** execution leaves the declaration's scope
**Then** the driver closes its database connections

Covers:
- `req~automatically-dispose-driver-resources~1`

Needs: dsn, uman

### Automatically Dispose a Prepared Statement
`scn~async-dispose-prepared-statement~1`

**Given** a prepared statement in an `await using` declaration
**When** execution leaves the declaration's scope
**Then** the driver closes the prepared statement and releases its connection

Covers:
- `req~automatically-dispose-driver-resources~1`

Needs: dsn, uman

### Browser Connection Uses Native WebSocket
`scn~browser-connection-uses-native-websocket~1`

**Given** a browser application with native `WebSocket`
**When** the application creates a driver with a factory returning `new WebSocket(url)`
**Then** the driver can use the browser WebSocket implementation without a Node.js WebSocket dependency

Covers:
- `req~run-in-browser~1`

Needs: dsn

### Node Connection Uses Injected WebSocket
`scn~node-connection-uses-injected-websocket~1`

**Given** a Node.js application with a WebSocket implementation such as `ws`
**When** the application creates a driver with a factory returning a compatible WebSocket
**Then** the driver can connect with the supplied Node.js WebSocket implementation

Covers:
- `req~run-in-nodejs~1`

Needs: dsn

### Pool Reuses Drivers for Queries
`scn~pool-reuses-drivers-for-queries~1`

**Given** a configured `ExasolPool`
**When** the application submits multiple queries
**Then** the pool acquires driver instances, runs the queries, and releases drivers after each operation

Covers:
- `req~manage-connection-pool~1`

Needs: dsn

### Pool Enforces Configured Size Limits
`scn~pool-enforces-configured-size-limits~1`

**Given** a configured `ExasolPool` with minimum and maximum pool sizes
**When** the application submits more concurrent work than one driver can serve
**Then** the pool creates and reuses driver instances without exceeding the configured pool size limits

Covers:
- `req~manage-connection-pool~1`

Needs: dsn

### Pool Shutdown
`scn~pool-shutdown~1`

**Given** a configured `ExasolPool`
**When** the application calls `drain()` and then `clear()`
**Then** the pool stops accepting new work and closes pooled driver instances

Covers:
- `req~manage-connection-pool~1`

Needs: dsn

### Automatically Dispose a Connection Pool
`scn~async-dispose-connection-pool~1`

**Given** an `ExasolPool` in an `await using` declaration
**When** execution leaves the declaration's scope
**Then** the pool drains and clears its driver instances

Covers:
- `req~automatically-dispose-driver-resources~1`

Needs: dsn, uman

### CSV Import

#### CSV Import Succeeds
`scn~csv-import-succeeds~1`

**Given** a Node.js application, an authenticated driver, a readable local CSV file, and an existing target table
**When** the application calls `importFromCsvFile()`
**Then** the driver streams the file through Exasol's import tunnel and resolves with the imported row count

Covers:
- `req~import-local-csv-files~1`

Needs: dsn

#### CSV Import Rejects Missing Target Table
`scn~csv-import-rejects-missing-target-table~1`

**Given** a Node.js application, an authenticated driver, a readable local CSV file, and a target table name that does not exist
**When** the application calls `importFromCsvFile()`
**Then** the driver rejects with the SQL error returned by Exasol for the missing table

Covers:
- `req~import-local-csv-files~1`

Needs: dsn

#### CSV Import Rejects Missing File
`scn~csv-import-rejects-missing-file~1`

**Given** a Node.js application and an authenticated driver
**When** the application calls `importFromCsvFile()` with a missing or unreadable file path
**Then** the driver rejects before opening the import tunnel and reports a file-not-found error

Covers:
- `req~import-local-csv-files~1`

Needs: dsn

#### CSV Import Applies Format Options
`scn~csv-import-applies-format-options~1`

**Given** a Node.js application and CSV format options for `columnSeparator`, `columnDelimiter`, `rowSeparator`, `encoding`, `skip`, `trim`, or `null`
**When** the application calls `importFromCsvFile()` with those options
**Then** the driver adds the corresponding Exasol `IMPORT FROM CSV` format clauses

Covers:
- `req~configure-csv-format~1`

Needs: dsn

#### CSV Import Is Cancelled
`scn~csv-import-is-cancelled~1`

**Given** a Node.js application importing a local CSV file with an `AbortSignal`
**When** the application aborts the signal while the import is in flight
**Then** the driver stops streaming the file, closes the import tunnel, aborts the server-side import query, and rejects promptly with an `AbortError`

Covers:
- `req~cancel-csv-file-import~1`

Needs: dsn, uman

### CSV Export

#### CSV Export Table Succeeds
`scn~csv-export-table-succeeds~1`

**Given** a Node.js application, an authenticated driver, an Exasol table, and a destination path that does not exist
**When** the application calls `exportToCsvFile()`
**Then** the driver streams the exported CSV data through Exasol's export tunnel into the new local file and resolves with the exported row count

Covers:
- `req~export-local-csv-files~1`

Needs: dsn

#### CSV Export Query Succeeds
`scn~csv-export-query-succeeds~1`

**Given** a Node.js application, an authenticated driver, a parenthesized Exasol `SELECT` query, and a destination path that does not exist
**When** the application calls `exportToCsvFile()`
**Then** the driver streams the query result as CSV data through Exasol's export tunnel into the new local file and resolves with the exported row count

Covers:
- `req~export-local-csv-files~1`

Needs: dsn

#### CSV Export Rejects Existing Destination
`scn~csv-export-rejects-existing-destination~1`

**Given** a Node.js application, an authenticated driver, and a destination path that already exists
**When** the application calls `exportToCsvFile()`
**Then** the driver rejects before opening the export tunnel with error code `E-EDJS-30` and leaves the existing file unchanged

Covers:
- `req~export-local-csv-files~1`

Needs: dsn

#### CSV Export Applies Format Options
`scn~csv-export-applies-format-options~1`

**Given** a Node.js application and CSV export format options for `columnSeparator`, `columnDelimiter`, `rowSeparator`, `encoding`, `null`, or `withColumnNames`
**When** the application calls `exportToCsvFile()` with those options
**Then** the driver adds the corresponding Exasol `EXPORT INTO CSV` format clauses

Covers:
- `req~configure-csv-export-format~1`

Needs: dsn

#### CSV Export Streams Chunked Request Bodies
`scn~csv-export-streams-chunked-request-body~1`

**Given** an in-flight CSV export whose tunnel sends an HTTP request with `Transfer-Encoding: chunked`
**When** the driver receives the request body
**Then** the driver decodes the HTTP chunks and writes their payload data to the destination file

Covers:
- `req~export-local-csv-files~1`

Needs: dsn

### Connection Encryption

#### Encrypted Connection by Default
`scn~encrypted-connection-by-default~1`

**Given** a driver configuration that does not override encryption
**When** the application connects
**Then** the driver builds a secure WebSocket URL by default

Covers:
- `req~encrypt-connections-by-default~1`

Needs: dsn

### Connection Configuration

#### Session Attributes Sent During Login
`scn~session-attributes-sent-during-login~1`

**Given** a driver configuration with session attributes
**When** the application connects
**Then** the driver sends supported attributes such as autocommit, schema, and compression during login

Covers:
- `req~configure-session-attributes~1`

Needs: dsn

#### Result Row Limit Applied During Fetch
`scn~result-row-limit-applied-during-fetch~1`

**Given** a configured `resultSetMaxRows` value and a query result with more rows available
**When** the driver fetches additional result data
**Then** the driver stops appending rows after the configured maximum, even if Exasol can provide more rows

Comment:

The driver applies this limit while assembling the fetched result pages. It does not change the SQL statement or send a separate server-side row-limit command.

Covers:
- `req~configure-session-attributes~1`

Needs: dsn

## Open Issues

### CSV Import Runtime Documentation

Source evidence:

* README says the package works in Node.js and the browser.
* User guide and code state that `importFromCsvFile()` is Node.js-only.

Issue:

CSV import is a package feature, but it is not available in the browser runtime.

Decision needed:

Keep end-user documentation explicit that CSV import is Node.js-only.
