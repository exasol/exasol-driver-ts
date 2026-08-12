# Crosscutting Concepts

This chapter captures concepts that affect multiple parts of the architecture.

## Domain Model

The central model is the Exasol SQL protocol:

* `ExasolDriver` represents a logical database session.
* `Connection` wraps one WebSocket connection.
* Command classes represent Exasol protocol commands.
* `SQLResponse<T>` models status, exception, and response data.
* `QueryResult` presents result-set columns and row objects.
* `ExasolPool` manages multiple driver instances.
* `CsvFormatOptions` represents Exasol CSV import format clauses.

## Configuration

Driver configuration is passed to constructors and merged with defaults. Important defaults include:

* `host`: `localhost`
* `port`: `8563`
* `fetchSize`: `1024 * 1024`
* `clientName`: `Javascript client`
* `clientVersion`: `1`
* `autocommit`: `true`
* `compression`: `false`

Pool configuration defaults to `minimumPoolSize` `0` and `maximumPoolSize` `5`.

## Error Handling

The driver uses predefined error objects and `ExaErrorBuilder` error codes for common failures. Examples include invalid credentials, closed connections, malformed results, invalid return types, invalid prepared-statement value counts, CSV missing files, import tunnel errors, and SQL errors returned by Exasol.

SQL protocol responses with status `error` are converted to SQL errors when command execution expects a row count. Missing exception details are treated as an internal protocol error.

## Logging and Observability

The public constructors accept an `ILogger`. The default logger is disabled. Internal code emits trace, debug, warn, error, and log messages around connection handling, command execution, fetching, compression, and pool failures. The library does not emit metrics or telemetry.

## Security and Privacy

Encrypted WebSocket communication is enabled by default. Basic-auth password login encrypts the password with the Exasol-provided RSA public key before sending it. Token authentication is supported through access or refresh tokens. The library does not persist credentials.

CSV import only supports encrypted tunnel connections. The driver creates an ad-hoc certificate for the import tunnel and passes the certificate fingerprint to Exasol in the import SQL. Exasol uses this fingerprint to verify that the import tunnel is connected to the expected client.

Vulnerability reporting is documented in `SECURITY.md`.

## Open Issues

* Credential lifecycle and recommended secret handling are not documented beyond constructor parameters.
* The Node.js CSV import tunnel security model is inferred from implementation and tests, not from an architecture decision record.
