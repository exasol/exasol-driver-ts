# Solution Strategy

This chapter summarizes the main technical approach for realizing the system requirements.

## Main Technical Approach

The library wraps Exasol's WebSocket SQL protocol in TypeScript classes. `ExasolDriver` owns one logical database session, translates high-level method calls into protocol commands, fetches result sets, converts successful query results into `QueryResult`, and converts successful commands into row counts. `ExasolPool` reuses `ExasolDriver` instances through `generic-pool`.

Runtime portability is achieved by injecting the WebSocket implementation through a factory function instead of importing a concrete browser or Node.js WebSocket.

## Key Quality Drivers

* Portability between browser and Node.js for the core driver.
* Secure communication by default through encrypted WebSocket URLs.
* Simple public API for common SQL query and command use cases.
* Testability through separated Node.js, jsdom, and integration test projects.
* Maintainability through TypeScript types, ESLint, Prettier, and focused modules.

## Reuse of Existing Facilities

The implementation reuses:

* WebSocket implementations supplied by applications.
* `generic-pool` for pooling.
* `pako` for optional compression and decompression.
* `node-forge` for password encryption and CSV import certificate generation.
* Node.js `fs`, `net`, `tls`, and `path` modules for CSV import.
* Jest, ts-jest, babel-jest, ESLint, Prettier, npm audit, and SonarCloud for verification.

## Data and Control Flow Strategy

Application code calls the public driver or pool API. The driver acquires a connection, builds a command object, serializes it as JSON, optionally compresses it, sends it over WebSocket, parses the response, fetches additional result pages when required, closes result sets, and releases the connection.

For CSV import, the driver verifies local file readability, opens an Exasol import tunnel, wraps it in TLS with an ad-hoc certificate, starts the Exasol import SQL command, and streams the file through the tunnel.

## Open Issues

* The code reports `clientOs` and `clientRuntime` as `Browser` in login metadata even when running in Node.js.
