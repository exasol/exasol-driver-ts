# Runtime View

This chapter describes relevant runtime interactions for the main use cases and extension points.

Terms use the definitions from [System Requirements](../system_requirements.md).

## Connection and Authentication

The connection, login, command, result, fetch, and cancellation flows are based on the [Exasol WebSocket API](https://github.com/exasol/websocket-api).

### Connect with Basic Authentication
`dsn~runtime-connect-basic-authentication~1`

**Given** a driver configured with user, password, host, port, encryption flag, and WebSocket factory
**When** `connect()` is called
**Then** the driver builds the WebSocket URL, creates a `Connection`, sends a login command, encrypts the password with the returned public key, sends login metadata and session attributes, enables compression if configured, and resolves the connection promise

Status: draft

Covers:
- `scn~connect-with-basic-authentication~1`
- `scn~encrypted-connection-by-default~1`
- `scn~session-attributes-sent-during-login~1`
- `constr~exasol-websocket-sql-protocol~1`

### Reject Missing Credentials
`dsn~runtime-reject-missing-credentials~1`

**Given** a driver without basic-auth credentials and without token credentials
**When** `connect()` is called
**Then** the driver rejects with `ErrInvalidCredentials` before opening a WebSocket

Status: draft

Covers:
- `scn~reject-missing-credentials~1`

## SQL Execution

### Query Execution
`dsn~runtime-query-execution~1`

**Given** an authenticated driver and SQL text
**When** `query()` is called
**Then** the driver sends an `execute` command, fetches remaining result pages, closes remote result sets, validates that the result is a result set, and returns `QueryResult`

Status: draft

Covers:
- `scn~query-returns-rows~1`
- `scn~result-row-limit-applied-during-fetch~1`

### Command Execution
`dsn~runtime-command-execution~1`

**Given** an authenticated driver and SQL text
**When** `execute()` is called
**Then** the driver sends an `execute` command, fetches required response data, validates that the result is a row count, and returns that row count

Status: draft

Covers:
- `scn~execute-returns-row-count~1`

### Raw Response Execution
`dsn~runtime-raw-response-execution~1`

**Given** an authenticated driver
**When** `query()` or `execute()` is called with `responseType` set to `raw`
**Then** the driver returns the fetched `SQLResponse<SQLQueriesResponse>` without normalized conversion

Status: draft

Covers:
- `scn~raw-response-requested~1`

### Prepared Statement Execution
`dsn~runtime-prepared-statement-execution~1`

**Given** an authenticated driver and prepared SQL text
**When** `prepare()` and `Statement.execute()` are called
**Then** the driver creates a prepared statement, validates that supplied values align with parameter columns, sends column-oriented data to Exasol, and releases the connection when the statement is closed

Status: draft

Covers:
- `scn~prepared-statement-execution~1`

### Query Cancellation
`dsn~runtime-query-cancellation~1`

**Given** an operation using a connection
**When** the application invokes the cancel callback or `driver.cancel()`
**Then** the connection sends `abortQuery` without waiting for a result payload

Status: draft

Covers:
- `scn~cancel-active-work~1`

## Runtime Portability

### Browser WebSocket Runtime
`dsn~runtime-browser-websocket~1`

**Given** a browser application
**When** the application creates a driver with a factory returning the browser `WebSocket`
**Then** the driver uses the supplied object through the `ExaWebsocket` interface

Status: draft

Covers:
- `scn~browser-connection-uses-native-websocket~1`
- `constr~browser-and-nodejs-runtime-support~1`
- `constr~injectable-websocket-implementation~1`

### Node.js WebSocket Runtime
`dsn~runtime-node-websocket~1`

**Given** a Node.js application
**When** the application creates a driver with a factory returning a compatible WebSocket such as `ws`
**Then** the driver uses the supplied object through the same `ExaWebsocket` interface

Status: draft

Covers:
- `scn~node-connection-uses-injected-websocket~1`
- `constr~browser-and-nodejs-runtime-support~1`
- `constr~injectable-websocket-implementation~1`

## Pooling

### Pooled Query Execution
`dsn~runtime-pooled-query-execution~1`

**Given** an `ExasolPool`
**When** a query is submitted
**Then** the pool acquires a driver, delegates the query, releases the driver in a `finally` block, and logs/rethrows errors

Status: draft

Covers:
- `scn~pool-executes-concurrent-queries~1`

### Pool Shutdown
`dsn~runtime-pool-shutdown~1`

**Given** an `ExasolPool`
**When** `drain()` and `clear()` are called
**Then** the underlying `generic-pool` drains pending work and destroys pooled drivers by closing them

Status: draft

Covers:
- `scn~pool-shutdown~1`

## CSV Import

### CSV Import File Stream
`dsn~runtime-csv-import-file-stream~1`

**Given** a Node.js driver, readable local CSV file, and target table
**When** `importFromCsvFile()` is called
**Then** the driver verifies file readability, creates an Exasol tunnel, wraps it with TLS, executes `IMPORT INTO ... FROM CSV`, waits for Exasol's HTTP request, streams the file using chunked HTTP response data, destroys the secure socket, and returns the import row count

Status: draft

Covers:
- `scn~csv-import-succeeds~1`
- `constr~node-only-csv-import~1`

### CSV Import Missing File
`dsn~runtime-csv-import-missing-file~1`

**Given** a missing or unreadable local CSV file
**When** `importFromCsvFile()` is called
**Then** the driver rejects with error code `E-EDJS-14` before creating an Exasol tunnel

Status: draft

Covers:
- `scn~csv-import-rejects-missing-file~1`
- `constr~node-only-csv-import~1`

### CSV Import Format Options
`dsn~runtime-csv-import-format-options~1`

**Given** CSV format options
**When** the import SQL is built
**Then** the driver appends Exasol CSV clauses for configured separator, delimiter, row separator, encoding, skip count, trim mode, and NULL literal while escaping SQL string literals

Status: draft

Covers:
- `scn~csv-import-applies-format-options~1`
