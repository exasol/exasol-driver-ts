# Exasol Driver ts 0.9.0, released 2026-??-??

Code name: Connection Strings with Failover and Certificate Fingerprints

## Summary

This release adds support for Exasol connection strings in the `host` property, using the same syntax as the other Exasol drivers. A connection string can list several cluster nodes as host ranges (`10.0.0.10..12`, `exasol1..3`), comma-separated hosts and IPv6 addresses in brackets, and can contain a port that takes precedence over the `port` property. Node.js local file import and export open their tunnel to the node the driver is connected to. The driver and the connection pool try the hosts in random order and fail over to the next host when the WebSocket to a host cannot be opened.

The new `connectTimeout` property limits how long the driver waits for the WebSocket to a single host to open, and separately how long it waits for the login. It defaults to 20 seconds; `0` disables it. If opening the WebSocket times out, the driver tries the next host; if the login times out, `connect()` rejects with `E-EDJS-44`. Previously there was no timeout, so connections that take longer than 20 seconds to open the WebSocket or to log in now fail unless you increase `connectTimeout`. This also applies when the WebSocket URL is set explicitly with the `url` property.

When no host can be reached, `connect()` now rejects with error `E-EDJS-42`, which lists every host with its cause, instead of the socket error of the single host. If no WebSocket can be opened, the driver is no longer closed permanently, so `connect()` can be called again. A WebSocket error after the WebSocket opened still closes the driver, as before. If the WebSocket closes or fails before it opens, the driver calls `onError` once for the connection attempt; it no longer calls `onClose` in this case, because no connection was open. `onError` remains reserved for WebSocket errors: it is not called for configuration errors such as an invalid connection string.

When the login fails, the driver now closes the WebSocket and discards the unauthenticated connection instead of leaving it open.

The driver now supports the same server certificate modes as the other Exasol drivers. A SHA-256 certificate fingerprint in the connection string (`host/fingerprint`) makes the driver accept only that certificate and skip the certificate authority and host name checks, for example for Exasol SaaS private endpoints with self-signed certificates. Fingerprints must have the 64 hexadecimal characters of a SHA-256 fingerprint; others are rejected with `E-EDJS-48` before connecting. The driver verifies the fingerprint before sending credentials or any Exasol command; if it does not match, `connect()` rejects with `E-EDJS-46` without trying other hosts. The new `validateServerCertificate` property (default `true`) and the fingerprint `nocertcheck` accept any certificate and log a warning to the configured logger; use them instead of `NODE_TLS_REJECT_UNAUTHORIZED=0`. These modes require Node.js and a WebSocket factory that returns `ws` WebSockets; the browser entry point rejects them with `E-EDJS-45`.

`ExasolPool` no longer retries forever when it cannot open a connection, for example because of wrong credentials, unreachable hosts or a fingerprint mismatch. The query now rejects with the connection error; the next query tries again.

The WebSocket factory now receives a second argument `{ rejectUnauthorized }`, which it should pass on to `ws`. Existing factories keep working for the default certificate validation.

## Features

* #123: Added support for Exasol connection strings with host ranges, host lists and failover
* #41: Added server certificate fingerprint validation and the `validateServerCertificate` property

## Bugfixes

* #128: Fixed `ExasolPool` retrying forever when it cannot create a connection

## Security

* Updated `node-forge` to 1.4.3 to fix multiple vulnerabilities (e.g. GHSA-86w9-cpqp-85rv, GHSA-6qrw-m8cv-hcxf, GHSA-5cwg-6vw7-rj6p)

## Dependency Updates

### Compile Dependency Updates

* Updated `node-forge:^1.4.0` to `^1.4.3`
