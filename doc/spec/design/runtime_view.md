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

### Login Metadata
`dsn~runtime-login-metadata~1`

**Given** a driver starting either basic or token authentication
**When** the driver builds the authenticated login command
**Then** it uses one shared browser-compatible login-options builder for common protocol fields, derives the driver version from build-time package metadata without a runtime filesystem or Node.js dependency, caller-configured metadata takes precedence, and missing metadata is derived best-effort from Node.js built-ins or browser navigator data without a static Node.js import in the browser-compatible entry point

Covers:
- `scn~login-metadata-sent-during-login~1`

Needs: impl, utest, itest

### Parse Connection String
`dsn~runtime-dsn-parsing~1`

**Given** a driver without an explicit `url`
**When** `connect()` is called
**Then** the driver parses `host` as a connection string with the same grammar as pyexasol, expands it to a list of hosts with port and optional fingerprint, and rejects an invalid connection string before opening a WebSocket

Comment:

* Each comma-separated part is `prefix[start..end[suffix]][/fingerprint][:port]`, or a bracketed IPv6 address `[address][/fingerprint][:port]` without range.
* A range expands to `prefix + n + suffix` and keeps the zero padding of `start`.
* Ports and fingerprints apply backwards to preceding parts without their own.
* Host names may only contain letters, digits, `.`, `-` and `_`.
* Rejected with `E-EDJS-39`: invalid parts, ports outside 1-65535 and empty strings.
* Rejected with `E-EDJS-48`: fingerprints other than `nocertcheck` that do not have the 64 hexadecimal characters of a SHA-256 fingerprint.
* Rejected with `E-EDJS-9`: descending ranges.
* Rejected with `E-EDJS-43`: more than 10000 expanded hosts.

Rationale:

The character restriction makes the host and port end up in the WebSocket URL exactly as written; pyexasol rejects other names when it resolves them. Host names are not resolved to IP addresses, so that TLS host name verification and browser runtimes keep working.

Covers:
- `scn~connection-string-hosts-expanded~1`

Needs: impl, utest, itest

### Connection String Failover
`dsn~runtime-dsn-failover~1`

**Given** a parsed connection string with one or more hosts
**When** `connect()` opens the WebSocket
**Then** the driver shuffles the hosts and creates a WebSocket for each in turn until one fires `open`; an `error` or `close` event before `open`, a timeout, or an exception from the WebSocket factory counts as a failed host. Once a WebSocket is open, the driver creates the `Connection` and logs in without failover. If all hosts fail, the driver calls `onError` once (and not `onClose`, as no WebSocket was open) and rejects with `E-EDJS-42` listing each WebSocket URL with its cause; the driver stays usable for another `connect()`. `connect()` on a closed driver rejects with `ErrClosed` without opening a WebSocket. `close()` aborts a WebSocket that is still opening and stops trying further hosts; if a WebSocket opened just before `close()`, the driver closes it instead of logging in. In both cases `connect()` rejects with `ErrClosed` and `onError` is not called. Pools get failover because every pooled driver connects independently. An explicit `url` is used as the only target.

Covers:
- `scn~connection-string-failover~1`

Needs: impl, utest, itest

### Discard Connection After Failed Login
`dsn~runtime-discard-failed-login-connection~1`

**Given** a WebSocket that opened
**When** the login is rejected or the connection cannot be added to the driver's internal pool
**Then** the driver removes exactly that connection from the pool, closes its WebSocket, and rejects `connect()`, so that no unauthenticated connection is reused or left open

Covers:
- `scn~connection-string-failover~1`

Needs: impl, utest

### Connect Timeout
`dsn~runtime-dsn-connect-timeout~1`

**Given** a configured `connectTimeout` greater than zero and at most 2147483647, the maximum `setTimeout` delay (default 20000 ms; other values disable the timeout)
**When** a WebSocket does not open within that time, or the login on an open WebSocket does not complete within that time
**Then** for the WebSocket, the driver rejects that attempt with `E-EDJS-41`, closes the WebSocket, and replaces its event handlers with no-op handlers so that late events of abandoned WebSockets are ignored; for the login, the driver removes the connection from its internal pool, breaks it (a graceful disconnect would wait behind the pending login command), and rejects `connect()` with `E-EDJS-44` without trying another host

Rationale:

pyexasol uses `connection_timeout` (default 10 s) for opening the WebSocket and `socket_timeout` (default 30 s) for every request, including the login. The driver uses one timeout for both phases, because a timeout for every request would also abort long-running queries

Covers:
- `scn~connection-string-connect-timeout~1`

Needs: impl, utest

### Select Server Certificate Mode
`dsn~runtime-certificate-mode-selection~1`

**Given** a driver about to open WebSockets
**When** `connect()` determines the targets
**Then** for each target the driver passes `{ rejectUnauthorized }` as second argument to the WebSocket factory: `false` for hosts with a fingerprint (including `NOCERTCHECK`) and for targets without fingerprint when `validateServerCertificate` is `false` (also for an explicit `url`), `true` otherwise

Covers:
- `scn~server-certificate-validation-disabled~1`
- `scn~connection-string-fingerprint-validated~1`

Needs: impl, utest, itest

### Warn About Disabled Certificate Validation
`dsn~runtime-disabled-validation-warning~1`

**Given** a driver about to open WebSockets
**When** at least one target skips the certificate validation without a fingerprint
**Then** the driver logs a warning once per `connect()`

Covers:
- `scn~server-certificate-validation-disabled~1`

Needs: impl, utest, itest

### Warn About Factories Without Options
`dsn~runtime-factory-options-warning~1`

**Given** a driver about to open WebSockets with a WebSocket factory that declares fewer than two parameters (`Function.length`)
**When** at least one target skips the certificate validation
**Then** the driver logs a warning that the factory probably ignores the options

Rationale:

One-argument factories keep working, because they only lose the option for modes they did not support before. The warning helps users who enabled a fingerprint or disabled validation but did not update their factory.

Covers:
- `scn~server-certificate-validation-disabled~1`

Needs: impl, utest

### Verify Server Certificate Fingerprint
`dsn~runtime-fingerprint-verification~1`

**Given** a Node.js driver and a host with a hexadecimal fingerprint
**When** the WebSocket to that host emits the `ws` `upgrade` event with a peer certificate
**Then** the driver compares the certificate's `fingerprint256` without colons with the upper-cased fingerprint from the connection string; on a mismatch it closes the WebSocket in the listener and rejects `connect()` with `E-EDJS-46` (calling `onError`) without trying further hosts

Comment:

The login is only sent after a successful check; only the WebSocket upgrade request precedes it.

Covers:
- `scn~connection-string-fingerprint-validated~1`
- `scn~fingerprint-mismatch-rejected~1`

Needs: impl, utest, itest

### Fail Closed When the Fingerprint Cannot Be Verified
`dsn~runtime-unverifiable-fingerprint~1`

**Given** a Node.js driver and a host with a hexadecimal fingerprint
**When** the WebSocket has no `once` method, its `upgrade` event has no peer certificate, or it fires `open` before a successful check
**Then** the driver closes the WebSocket and treats the host as failed with `E-EDJS-47`

Rationale:

This happens with WebSocket implementations other than `ws`. The driver cannot tell whether the factory honored `rejectUnauthorized`, so it never uses such a WebSocket. Unlike a mismatch, this is no sign of an attack, so the driver tries the next host.

Covers:
- `scn~fingerprint-mismatch-rejected~1`

Needs: impl, utest

### Suggest a Fingerprint for Untrusted Certificates
`dsn~runtime-untrusted-certificate-hint~1`

**Given** a Node.js driver that validates the server certificate of a host from the connection string
**When** opening a WebSocket fails because Node.js does not trust the certificate authority of the server certificate or the certificate does not cover the host name
**Then** the driver reports this host with `E-EDJS-49`, which names the host and the TLS error and suggests adding the certificate's fingerprint to the connection string

Comment:

The driver recognizes untrusted certificates by the Node.js TLS error code (for example `SELF_SIGNED_CERT_IN_CHAIN` or `ERR_TLS_CERT_ALTNAME_INVALID`) in the `error` property of the `ws` error event. Expired certificates and broken signatures keep `E-EDJS-16`, because they should be fixed on the server rather than pinned. An explicit `url` keeps `E-EDJS-16`, because it cannot contain a fingerprint. Browsers do not report the cause of a failed WebSocket, and the browser driver does not support fingerprints, so it keeps reporting `E-EDJS-16`.

Covers:
- `scn~untrusted-server-certificate-reported~1`

Needs: impl, utest, itest

### Reject Certificate Modes in Browsers
`dsn~runtime-browser-certificate-modes~1`

**Given** a driver from the browser entry point, which has no server certificate verifier
**When** `connect()` finds a target with a fingerprint or with disabled certificate validation
**Then** the driver rejects with `E-EDJS-45` before creating a WebSocket. The Node.js driver provides the verifier by overriding a protected hook, so the browser bundle contains no Node.js certificate code.

Covers:
- `scn~certificate-modes-unsupported-in-browsers~1`

Needs: impl, utest, itest

### Tunnel Address of Local File Transfer
`dsn~runtime-dsn-tunnel-address~1`

**Given** a Node.js driver without an explicit `url`
**When** a local file import or export starts
**Then** the driver first checks the local file and the abort signal, then resolves the tunnel address lazily: it connects if it has no live connection (an abort stops waiting for that) and opens the tunnel to the host and port (without IPv6 brackets) that the live `Connection` recorded when its WebSocket opened. The address belongs to the `Connection`, so it cannot outlive its WebSocket. With an explicit `url` it uses the configured `host` (without IPv6 brackets) and `port` as before.

Rationale:

This follows pyexasol, which opens the tunnel to the node of the WebSocket (`ws_ipaddr`, `ws_port`). Unlike pyexasol, the driver records the host name from the connection string, not a resolved IP address: browsers cannot resolve host names, and the `ExaWebsocket` interface does not expose the remote address. If one host name resolves to several cluster nodes, the tunnel may therefore reach a different node than the WebSocket, which works as long as that node is reachable

Covers:
- `scn~local-file-transfer-uses-connected-host~1`

Needs: impl, utest

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

Needs: impl, utest, itest

## SQL Execution

### Query Execution
`dsn~runtime-query-execution~3`

**Given** an authenticated driver and SQL text
**When** `query()` is called
**Then** the driver sends an `execute` command, fetches additional result-set pages until the result is complete or `resultSetMaxRows` is reached, closes remote result sets and consumes their acknowledgements before reusing the connection, validates that the result is a result set, and returns `QueryResult`

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

### Response Command Serialization
`dsn~runtime-response-command-serialization~1`

**Given** a `Connection` with multiple submitted response-producing protocol commands
**When** it receives a response for the command currently in flight
**Then** it resolves that command, sends the next command in FIFO order, and keeps `abortQuery` outside the response queue; an unexpected or malformed response marks the connection broken, rejects all pending commands, and closes the WebSocket

Covers:
- `scn~serialize-websocket-command-responses~1`

Needs: impl, utest

### In-Flight WebSocket Failure
`dsn~runtime-inflight-websocket-failure~1`

**Given** a `Connection` with a command awaiting a WebSocket response
**When** the WebSocket emits an error or close event
**Then** `Connection` marks itself broken and inactive, rejects the pending command with the available event details, and `ExasolPool` destroys the broken borrowed driver rather than returning it to the pool

Covers:
- `scn~reject-command-on-unexpected-websocket-termination~1`

Needs: impl, utest, itest

## Runtime Portability

### Browser WebSocket Runtime
`dsn~runtime-browser-websocket~2`

**Given** a browser application
**When** the application imports `@exasol/exasol-driver-ts/browser` and creates a driver or pool with a factory returning the browser `WebSocket`
**Then** the driver uses the supplied object through the `ExaWebsocket` interface

Covers:
- `scn~browser-connection-uses-native-websocket~2`
- `constr~browser-and-nodejs-runtime-support~1`
- `constr~injectable-websocket-implementation~1`

Needs: impl, utest, itest

### Node.js WebSocket Runtime
`dsn~runtime-node-websocket~2`

**Given** a Node.js application
**When** the application creates a driver with a factory returning a compatible WebSocket such as `ws`
**Then** the driver uses the supplied object through the same `ExaWebsocket` interface

Covers:
- `scn~node-connection-uses-injected-websocket~2`
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

### Pool Driver Creation Failure
`dsn~runtime-pool-create-failure~1`

**Given** an `ExasolPool` with pending `acquire()` calls
**When** creating a driver fails because `connect()` rejects
**Then** the pool rejects the oldest pending `acquire()` with that error

Rationale:

`generic-pool` would otherwise create a new driver for the pending `acquire()` right away and retry forever, because the pool sets no acquire timeout. `generic-pool` has no public API for this, so the pool handles its `factoryCreateError` event and rejects a request from its internal queue of waiting clients. If that queue is missing, the pool logs a warning, and unit tests detect if a `generic-pool` update breaks this.

Comment:

`generic-pool` does not report which request a creation was for, so a failed refill of `minimumPoolSize` can also reject a waiting query.

Covers:
- `scn~pool-query-rejected-when-connection-fails~1`

Needs: impl, utest

### Pooled Query Execution
`dsn~runtime-pooled-query-execution~1`

**Given** an `ExasolPool`
**When** a query is submitted
**Then** the pool acquires a driver, delegates the query, releases the driver in a `finally` block, and logs/rethrows errors

Covers:
- `scn~pool-reuses-drivers-for-queries~1`

Needs: impl, itest

### Pool Borrow Validation
`dsn~runtime-pool-borrow-validation~1`

**Given** an idle driver in an `ExasolPool`
**When** `generic-pool` borrows the driver for a query
**Then** it validates that the driver has no broken connection, destroys an invalid driver, and creates a replacement before delegating the query

Covers:
- `scn~replace-idle-closed-pooled-driver~1`

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

Needs: impl, utest, itest

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

## Parquet Import

### Parquet Import File Readability Check
`dsn~runtime-parquet-import-file-readability-check~1`

**Given** a Node.js driver and a local Parquet file path
**When** `importFromParquetFile()` is called
**Then** the driver checks file readability before creating an Exasol tunnel and rejects with error code `E-EDJS-14` if the file is missing or unreadable

Covers:
- `scn~parquet-import-rejects-missing-file~1`
- `constr~node-only-parquet-import~1`

Needs: impl, utest

### Parquet Import File Stream
`dsn~runtime-parquet-import-file-stream~1`

**Given** a Node.js driver connected to Exasol 2025.1.9 or later, a readable local Parquet file, and a target table
**When** `importFromParquetFile()` is called
**Then** the driver creates an Exasol tunnel, wraps it with TLS, executes `IMPORT INTO ... FROM PARQUET` with `MaxConcurrentReads=1`, serves Exasol's sequential HTTP `HEAD` and byte-range `GET` requests with file-size and range-aware responses, destroys the secure socket, and returns the import row count

Evidence: [Exasol changelog 28781](https://docs.exasol.com/db/latest/changelogs/28781.htm) introduced HTTP/HTTPS Parquet imports in Exasol 2025.1.9, which the local-file tunnel requires.

Covers:
- `scn~parquet-import-succeeds~1`
- `constr~node-only-parquet-import~1`

Needs: impl, utest, itest

### Parquet Import Version Support
`dsn~runtime-parquet-import-version-support~1`

**Given** an Exasol version before 2025.1.9 and a request to import a local Parquet file
**When** the driver executes the `IMPORT FROM PARQUET` statement
**Then** Exasol rejects the statement with its version-support message, which the driver includes in its standardized SQL error returned to the application

Covers:
- `scn~parquet-import-rejects-unsupported-server~1`

Note: We don't cover this with an integration test because this would require testing with an outdated Exasol version.

### Parquet Import Cancellation
`dsn~runtime-parquet-import-cancellation~1`

**Given** an in-flight Parquet import with an `AbortSignal`
**When** the signal is aborted
**Then** the driver destroys the file stream and both import-tunnel sockets, sends `abortQuery` for the server-side import without waiting for its response, and rejects the import promise with an `AbortError` using `E-EDJS-37`

Covers:
- `scn~parquet-import-is-cancelled~1`

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
