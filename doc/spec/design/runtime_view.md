# Runtime View

This chapter describes relevant runtime interactions for the main use cases and extension points.

Terms use the definitions from [System Requirements](../system_requirements.md).

## Connection and Authentication

The connection, login, command, result, fetch, and cancellation flows are based on the [Exasol WebSocket API](https://github.com/exasol/websocket-api).

### Connect with Basic Authentication
`dsn~runtime-connect-basic-authentication~1`

**Given** a driver configured with user, password, host, port, and WebSocket factory
**When** `connect()` is called
**Then** the driver builds the WebSocket URL, creates a `Connection`, sends a login command, encrypts the password with the returned public key, sends login metadata and session attributes, enables compression if configured, and resolves the connection promise

Covers:
- `scn~connect-with-basic-authentication~1`
- `scn~encrypted-connection-by-default~1`
- `scn~session-attributes-sent-during-login~1`
- `constr~exasol-websocket-sql-protocol~1`

Needs: impl, itest

### Reject Missing Credentials
`dsn~runtime-reject-missing-credentials~1`

**Given** a driver without basic-auth credentials and without token credentials
**When** `connect()` is called
**Then** the driver rejects with `ErrInvalidCredentials` before opening a WebSocket

Covers:
- `scn~reject-missing-credentials~1`

Needs: impl, utest

### Driver Async Disposal
`dsn~runtime-driver-async-disposal~1`

**Given** a connected `ExasolDriver`
**When** TypeScript invokes `Symbol.asyncDispose`
**Then** the driver delegates to `close()` and waits for all connections to close

Covers:
- `scn~async-dispose-driver~1`

Needs: impl, utest

## SQL Execution

### Query Execution
`dsn~runtime-query-execution~2`

**Given** an authenticated driver and SQL text
**When** `query()` is called
**Then** the driver sends an `execute` command, fetches additional result-set pages until the result is complete or `resultSetMaxRows` is reached, closes remote result sets, validates that the result is a result set, and returns `QueryResult`

Covers:
- `scn~query-returns-rows~1`
- `scn~result-row-limit-applied-during-fetch~1`

Needs: impl, utest, itest

#### Fetch Size
`dsn~runtime-query-fetch-size~1`

**Given** a configured `fetchSize` value and a query result with more rows available
**When** the driver fetches an additional result-set page
**Then** the driver requests the configured number of bytes from Exasol

Covers:
- `scn~configured-fetch-size-used-during-fetch~1`

Needs: impl, utest

### Command Execution
`dsn~runtime-command-execution~1`

**Given** an authenticated driver and SQL text
**When** `execute()` is called
**Then** the driver sends an `execute` command, follows the protocol fetch flow for result-set responses, validates that the final result is a row count, and returns that row count

Covers:
- `scn~execute-returns-row-count~1`

Needs: impl, utest, itest

### Raw Response Execution
`dsn~runtime-raw-response-execution~1`

**Given** an authenticated driver
**When** `query()` or `execute()` is called with `responseType` set to `raw`
**Then** the driver returns the fetched `SQLResponse<SQLQueriesResponse>` without converting it to a `QueryResult` or row count

Covers:
- `scn~raw-response-requested~1`

Needs: impl, utest, itest

### Prepared Statement Execution
`dsn~runtime-prepared-statement-execution~1`

**Given** an authenticated driver and prepared SQL text
**When** `prepare()` and `Statement.execute()` are called
**Then** the driver creates a prepared statement, validates that supplied positional values align with parameter columns, sends the positional values as column-oriented data to Exasol, and releases the connection when the statement is closed

Covers:
- `scn~prepared-statement-execution~1`

Needs: impl

### Prepared Statement Async Disposal
`dsn~runtime-prepared-statement-async-disposal~1`

**Given** a prepared `Statement`
**When** TypeScript invokes `Symbol.asyncDispose`
**Then** the statement delegates to `close()`, closes the remote statement, and releases its connection

Covers:
- `scn~async-dispose-prepared-statement~1`

Needs: impl, utest

### Query Cancellation
`dsn~runtime-query-cancellation~1`

**Given** an operation using a connection
**When** the application invokes the cancel callback or `driver.cancel()`
**Then** the connection sends `abortQuery` without waiting for a result payload

Covers:
- `scn~cancel-active-work~1`

Needs: impl, utest, itest

## Runtime Portability

### Browser WebSocket Runtime
`dsn~runtime-browser-websocket~1`

**Given** a browser application
**When** the application creates a driver with a factory returning the browser `WebSocket`
**Then** the driver uses the supplied object through the `ExaWebsocket` interface

Covers:
- `scn~browser-connection-uses-native-websocket~1`
- `constr~browser-and-nodejs-runtime-support~1`
- `constr~injectable-websocket-implementation~1`

Needs: impl, itest

### Node.js WebSocket Runtime
`dsn~runtime-node-websocket~1`

**Given** a Node.js application
**When** the application creates a driver with a factory returning a compatible WebSocket such as `ws`
**Then** the driver uses the supplied object through the same `ExaWebsocket` interface

Covers:
- `scn~node-connection-uses-injected-websocket~1`
- `constr~browser-and-nodejs-runtime-support~1`
- `constr~injectable-websocket-implementation~1`

Needs: impl, itest

## Pooling

### Pool Capacity Management
`dsn~runtime-pool-capacity-management~1`

**Given** concurrent work submitted to an `ExasolPool`
**When** the pool needs additional driver instances
**Then** the underlying `generic-pool` creates and reuses drivers while honoring the configured minimum and maximum size limits

Covers:
- `scn~pool-enforces-configured-size-limits~1`

Needs: impl, itest

### Pooled Query Execution
`dsn~runtime-pooled-query-execution~1`

**Given** an `ExasolPool`
**When** a query is submitted
**Then** the pool acquires a driver, delegates the query, releases the driver in a `finally` block, and logs/rethrows errors

Covers:
- `scn~pool-reuses-drivers-for-queries~1`

Needs: impl, itest

### Pool Shutdown
`dsn~runtime-pool-shutdown~1`

**Given** an `ExasolPool`
**When** `drain()` and then `clear()` are called
**Then** the underlying `generic-pool` drains pending work and destroys pooled drivers by closing them

Covers:
- `scn~pool-shutdown~1`

Needs: impl, itest

### Pool Async Disposal
`dsn~runtime-pool-async-disposal~1`

**Given** an `ExasolPool`
**When** TypeScript invokes `Symbol.asyncDispose`
**Then** the pool drains before clearing its pooled driver instances

Covers:
- `scn~async-dispose-connection-pool~1`

Needs: impl, utest

## CSV Import

### CSV Import File Readability Check
`dsn~runtime-csv-import-file-readability-check~1`

**Given** a Node.js driver and a local CSV file path
**When** `importFromCsvFile()` is called
**Then** the driver checks file readability before creating an Exasol tunnel and rejects with error code `E-EDJS-14` if the file is missing or unreadable

Covers:
- `scn~csv-import-rejects-missing-file~1`
- `constr~node-only-csv-import~1`

Needs: impl, utest

### CSV Import Missing Target Table
`dsn~runtime-csv-import-missing-target-table~1`

**Given** a readable local CSV file and a target table name that does not exist
**When** `importFromCsvFile()` executes the generated `IMPORT INTO ... FROM CSV` SQL
**Then** Exasol returns a SQL error and the driver rejects the import promise with that error

Covers:
- `scn~csv-import-rejects-missing-target-table~1`
- `constr~node-only-csv-import~1`

Needs: impl, itest

### CSV Import File Stream
`dsn~runtime-csv-import-file-stream~1`

**Given** a Node.js driver, readable local CSV file, and target table
**When** `importFromCsvFile()` is called
**Then** the driver creates an Exasol tunnel, wraps it with TLS, executes `IMPORT INTO ... FROM CSV`, waits for Exasol's HTTP request, streams the file using chunked HTTP response data, destroys the secure socket, and returns the import row count

Covers:
- `scn~csv-import-succeeds~1`
- `constr~node-only-csv-import~1`

Needs: impl, utest, itest

### CSV Import Format Options
`dsn~runtime-csv-import-format-options~1`

**Given** CSV format options
**When** the import SQL is built
**Then** the driver appends Exasol CSV clauses for configured separator, delimiter, row separator, encoding, skip count, trim mode, and NULL literal while escaping SQL string literals

Covers:
- `scn~csv-import-applies-format-options~1`

Needs: impl, utest, itest

### CSV Import Cancellation
`dsn~runtime-csv-import-cancellation~1`

**Given** an in-flight CSV import with an `AbortSignal`
**When** the signal is aborted
**Then** the driver destroys the file stream and both import-tunnel sockets, sends `abortQuery` for the server-side import without waiting for its response, and rejects the import promise with an `AbortError`

Covers:
- `scn~csv-import-is-cancelled~1`

Needs: impl, utest, itest

## CSV Export

### CSV Export Destination File
`dsn~runtime-csv-export-destination-file~1`

**Given** a Node.js driver and a local CSV export destination path
**When** `exportToCsvFile()` is called
**Then** the driver exclusively reserves the resolved path before creating an Exasol tunnel, rejects an existing file with `E-EDJS-30`, and removes its newly-created file when the export fails

Covers:
- `scn~csv-export-rejects-existing-destination~1`
- `constr~node-only-csv-export~1`

Needs: impl, utest, itest

### CSV Export File Stream
`dsn~runtime-csv-export-file-stream~1`

**Given** a Node.js driver, an Exasol table or parenthesized `SELECT` query, and a new local CSV destination
**When** `exportToCsvFile()` is called
**Then** the driver creates an Exasol tunnel, wraps it with TLS, executes `EXPORT <source> INTO CSV`, streams Exasol's content-length-delimited or chunked HTTP request body into the file, destroys the tunnel sockets, and returns the export row count

Covers:
- `scn~csv-export-table-succeeds~1`
- `scn~csv-export-query-succeeds~1`
- `constr~node-only-csv-export~1`

Needs: impl, utest, itest

### CSV Export Compressed File
`dsn~runtime-csv-export-compressed-file~1`

**Given** a new local export destination ending in `.zip`, `.gz`, or `.bz2`
**When** `exportToCsvFile()` builds the Exasol export SQL
**Then** the driver selects the matching canonical `001.zip`, `001.gz`, or `001.bz2` remote file name case-insensitively and writes Exasol's compressed bytes unchanged to the local file

Covers:
- `scn~csv-export-compressed-file-succeeds~1`
- `constr~node-only-csv-export~1`

Needs: impl, utest, itest

### CSV Export Format Options
`dsn~runtime-csv-export-format-options~1`

**Given** CSV export format options
**When** the export SQL is built
**Then** the driver appends Exasol CSV clauses for configured separator, delimiter, row separator, encoding, NULL literal, and column names while escaping SQL string literals

Covers:
- `scn~csv-export-applies-format-options~1`

Needs: impl, utest, itest

### CSV Export Chunked Request Stream
`dsn~runtime-csv-export-chunked-request-stream~1`

**Given** a tunnel HTTP request with `Transfer-Encoding: chunked`
**When** the shared tunnel body reader receives the request
**Then** it decodes the chunks and forwards only their payload data to a destination

Covers:
- `scn~csv-export-streams-chunked-request-body~1`
- `constr~node-only-csv-export~1`

Needs: impl, utest, itest

### CSV Export Cancellation
`dsn~runtime-csv-export-cancellation~1`

**Given** an in-flight CSV export with an `AbortSignal`
**When** the signal is aborted
**Then** the driver destroys the destination write stream and both export-tunnel sockets, sends `abortQuery` for a still-pending server-side export without waiting for its response, removes the newly created destination file, and rejects the export promise with an `AbortError` using `E-EDJS-31`

Covers:
- `scn~csv-export-is-cancelled~1`

Needs: impl, utest, itest
