# System Requirements

## Introduction

`@exasol/exasol-driver-ts` is a TypeScript and JavaScript driver for connecting applications to an Exasol database. Applications use the driver to open WebSocket connections, authenticate, execute SQL statements, fetch query results, manage a connection pool, and import local CSV files from Node.js.

The library is published as an npm package and is intended for both browser and Node.js runtimes. Browser applications use the runtime-provided `WebSocket` implementation. Node.js applications provide a compatible WebSocket implementation, for example the `ws` package.

## Goals

* Provide a typed Exasol SQL driver for TypeScript and JavaScript applications.
* Support both browser and Node.js runtimes through an injectable WebSocket factory.
* Expose simple APIs for connecting, querying, executing commands, and closing connections.
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

This document uses OpenFastTrace specification items to express product features, user requirements, and acceptance scenarios. Each specification item has a unique identifier in the form `<artifact-type>~<name>~<revision>`.

In this document, feature items use the artifact type `feat`, user requirements use `req`, and acceptance scenarios use `scn`. Design items under `doc/spec/design/` cover the scenarios with artifact type `dsn`. Architecture constraints in `doc/spec/design/constraints.md` use artifact type `constr` and are also covered by `dsn` items.

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

### Browser Application

A web application that uses the package with the browser's native `WebSocket`.

### Node.js Application

A server-side or local Node.js application that uses the package with a Node-compatible WebSocket implementation and can use Node-only CSV import.

### Database Operator

A person or automation responsible for providing database host, port, credentials, schema, TLS, and connectivity settings.

## Features

### SQL Connectivity
`feat~sql-connectivity~1`

The driver lets applications connect to Exasol, authenticate, execute SQL, read results, and close the connection.

Status: draft

Needs: req

### Runtime Portability
`feat~runtime-portability~1`

The driver supports browser and Node.js applications without hard-wiring one concrete WebSocket implementation.

Status: draft

Needs: req

### Connection Pooling
`feat~connection-pooling~1`

The driver provides a pool API for applications that need multiple reusable database connections.

Status: draft

Needs: req

### CSV File Import
`feat~csv-file-import~1`

The driver lets Node.js applications import local CSV files into Exasol tables.

Status: draft

Needs: req

### Secure and Configurable Sessions
`feat~secure-configurable-sessions~1`

The driver lets applications configure session behavior including TLS usage, authentication mode, autocommit, compression, schema, client metadata, fetch size, and result row limits.

Status: draft

Needs: req

## User Requirements

### Connect to Exasol
`req~connect-to-exasol~1`

The application developer must be able to create a driver with database connection settings, authenticate with credentials or tokens, and establish a database session.

Status: draft

Covers:
- `feat~sql-connectivity~1`

Needs: scn

### Execute SQL Queries
`req~execute-sql-queries~1`

The application developer must be able to execute a SQL query and retrieve result metadata and rows.

Status: draft

Covers:
- `feat~sql-connectivity~1`

Needs: scn

### Execute SQL Commands
`req~execute-sql-commands~1`

The application developer must be able to execute SQL commands and receive the affected row count.

Status: draft

Covers:
- `feat~sql-connectivity~1`

Needs: scn

### Receive Raw SQL Responses
`req~receive-raw-sql-responses~1`

The application developer must be able to request raw Exasol protocol responses for queries and commands when the normalized return type is not sufficient.

Status: draft

Covers:
- `feat~sql-connectivity~1`

Needs: scn

### Use Prepared Statements
`req~use-prepared-statements~1`

The application developer must be able to create prepared statements, execute them with positional values, and close them.

Status: draft

Covers:
- `feat~sql-connectivity~1`

Needs: scn

### Cancel Running Work
`req~cancel-running-work~1`

The application developer must be able to cancel active database work through the driver.

Status: draft

Covers:
- `feat~sql-connectivity~1`

Needs: scn

### Run in Browser and Node.js
`req~run-in-browser-and-nodejs~1`

The application developer must be able to use the same package in browser and Node.js runtimes by supplying an appropriate WebSocket factory.

Status: draft

Covers:
- `feat~runtime-portability~1`

Needs: scn

### Manage a Connection Pool
`req~manage-connection-pool~1`

The application developer must be able to create a connection pool with configurable minimum and maximum sizes, execute queries through it, drain it, and clear it.

Status: draft

Covers:
- `feat~connection-pooling~1`

Needs: scn

### Import Local CSV Files
`req~import-local-csv-files~1`

The Node.js application developer must be able to import a readable local CSV file into a target Exasol table and receive the imported row count.

Status: draft

Covers:
- `feat~csv-file-import~1`

Needs: scn

#### Configure CSV Format
`req~configure-csv-format~1`

The Node.js application developer must be able to configure CSV import format options including column separator, column delimiter, row separator, encoding, skipped rows, trimming, and NULL representation.

Status: draft

Covers:
- `feat~csv-file-import~1`

Needs: scn

### Configure Secure Sessions
`req~configure-secure-sessions~1`

The application developer must be able to use encrypted WebSocket connections by default and explicitly disable encryption when needed for local or test setups.

Status: draft

Covers:
- `feat~secure-configurable-sessions~1`

Needs: scn

### Configure Session Attributes
`req~configure-session-attributes~1`

The application developer must be able to configure session attributes including autocommit, schema, compression, fetch size, result row limit, client name, and client version.

Status: draft

Covers:
- `feat~secure-configurable-sessions~1`

Needs: scn

## Acceptance Scenarios

### Connect With Basic Authentication
`scn~connect-with-basic-authentication~1`

**Given** a configured driver with host, port, user, password, encryption setting, and WebSocket factory
**When** the application calls `connect()`
**Then** the driver opens a WebSocket connection, performs the Exasol login flow, and resolves after the session is authenticated

Status: draft

Covers:
- `req~connect-to-exasol~1`

Needs: dsn

### Reject Missing Credentials
`scn~reject-missing-credentials~1`

**Given** a configured driver without user/password and without access or refresh token
**When** the application calls `connect()`
**Then** the driver rejects the connection attempt with an invalid-credentials error

Status: draft

Covers:
- `req~connect-to-exasol~1`

Needs: dsn

### Query Returns Rows
`scn~query-returns-rows~1`

**Given** an authenticated driver and a SQL statement that returns a result set
**When** the application calls `query()`
**Then** the driver fetches all required result data, closes the remote result set, and returns a `QueryResult` exposing columns and row objects

Status: draft

Covers:
- `req~execute-sql-queries~1`

Needs: dsn

### Execute Returns Row Count
`scn~execute-returns-row-count~1`

**Given** an authenticated driver and a SQL statement that returns a row count
**When** the application calls `execute()`
**Then** the driver returns the row count

Status: draft

Covers:
- `req~execute-sql-commands~1`

Needs: dsn

### Raw Response Requested
`scn~raw-response-requested~1`

**Given** an authenticated driver
**When** the application calls `query()` or `execute()` with `responseType` set to `raw`
**Then** the driver returns the Exasol protocol response instead of converting it to a `QueryResult` or row count

Status: draft

Covers:
- `req~receive-raw-sql-responses~1`

Needs: dsn

### Prepared Statement Execution
`scn~prepared-statement-execution~1`

**Given** an authenticated driver and a SQL statement with parameters
**When** the application prepares the statement, executes it with a value count matching the parameter columns, and closes it
**Then** the driver sends Exasol prepared-statement commands and releases the underlying connection when the statement is closed

Status: draft

Covers:
- `req~use-prepared-statements~1`

Needs: dsn

### Cancel Active Work
`scn~cancel-active-work~1`

**Given** an active database operation
**When** the application calls the provided cancel function or `driver.cancel()`
**Then** the driver sends an Exasol abort query command

Status: draft

Covers:
- `req~cancel-running-work~1`

Needs: dsn

### Browser Connection Uses Native WebSocket
`scn~browser-connection-uses-native-websocket~1`

**Given** a browser application with native `WebSocket`
**When** the application creates a driver with a factory returning `new WebSocket(url)`
**Then** the driver can use the browser WebSocket implementation without a Node.js WebSocket dependency

Status: draft

Covers:
- `req~run-in-browser-and-nodejs~1`

Needs: dsn

### Node Connection Uses Injected WebSocket
`scn~node-connection-uses-injected-websocket~1`

**Given** a Node.js application with a WebSocket implementation such as `ws`
**When** the application creates a driver with a factory returning a compatible WebSocket
**Then** the driver can connect without depending on a browser runtime

Status: draft

Covers:
- `req~run-in-browser-and-nodejs~1`

Needs: dsn

### Pool Executes Concurrent Queries
`scn~pool-executes-concurrent-queries~1`

**Given** a configured `ExasolPool`
**When** the application submits multiple queries
**Then** the pool acquires driver instances, runs the queries, releases drivers after each operation, and enforces the configured pool size limits

Status: draft

Covers:
- `req~manage-connection-pool~1`

Needs: dsn

### Pool Shutdown
`scn~pool-shutdown~1`

**Given** a configured `ExasolPool`
**When** the application calls `drain()` and `clear()`
**Then** the pool stops accepting new work and closes pooled driver instances

Status: draft

Covers:
- `req~manage-connection-pool~1`

Needs: dsn

### CSV Import Succeeds
`scn~csv-import-succeeds~1`

**Given** a Node.js application, an authenticated driver, a readable local CSV file, and an existing target table
**When** the application calls `importFromCsvFile()`
**Then** the driver streams the file through Exasol's import tunnel and resolves with the imported row count

Status: draft

Covers:
- `req~import-local-csv-files~1`

Needs: dsn

### CSV Import Rejects Missing File
`scn~csv-import-rejects-missing-file~1`

**Given** a Node.js application and an authenticated driver
**When** the application calls `importFromCsvFile()` with a missing or unreadable file path
**Then** the driver rejects before opening the import tunnel and reports a file-not-found error

Status: draft

Covers:
- `req~import-local-csv-files~1`

Needs: dsn

### CSV Import Applies Format Options
`scn~csv-import-applies-format-options~1`

**Given** a Node.js application and CSV format options
**When** the application calls `importFromCsvFile()` with those options
**Then** the driver adds the corresponding Exasol `IMPORT FROM CSV` format clauses

Status: draft

Covers:
- `req~configure-csv-format~1`

Needs: dsn

### Encrypted Connection by Default
`scn~encrypted-connection-by-default~1`

**Given** a driver configuration that does not override encryption
**When** the application connects
**Then** the driver builds a secure WebSocket URL by default

Status: draft

Covers:
- `req~configure-secure-sessions~1`

Needs: dsn

### Session Attributes Sent During Login
`scn~session-attributes-sent-during-login~1`

**Given** a driver configuration with session attributes
**When** the application connects
**Then** the driver sends supported attributes such as autocommit, schema, and compression during login

Status: draft

Covers:
- `req~configure-session-attributes~1`

Needs: dsn

### Result Row Limit Applied During Fetch
`scn~result-row-limit-applied-during-fetch~1`

**Given** a configured `resultSetMaxRows` value and a query result with more rows available
**When** the driver fetches additional result data
**Then** it stops adding rows after the configured maximum

Status: draft

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
