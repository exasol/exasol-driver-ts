# Exasol Driver ts 0.9.0, released 2026-??-??

Code name: Connection Strings with Failover

## Summary

This release adds support for Exasol connection strings in the `host` property, using the same syntax as the other Exasol drivers. A connection string can list several cluster nodes as host ranges (`10.0.0.10..12`, `exasol1..3`), comma-separated hosts and IPv6 addresses in brackets, and can contain a port that takes precedence over the `port` property. Node.js local file import and export open their tunnel to the node the driver is connected to. The driver and the connection pool try the hosts in random order and fail over to the next host when the WebSocket to a host cannot be opened.

The new `connectTimeout` property limits how long the driver waits for the WebSocket to a single host to open. It defaults to 10 seconds; `0` disables it. Previously there was no timeout, so connections to hosts that take longer than 10 seconds to open the WebSocket now fail unless you increase `connectTimeout`. This also applies when the WebSocket URL is set explicitly with the `url` property.

When no host can be reached, `connect()` now rejects with error `E-EDJS-42`, which lists every host with its cause, instead of the socket error of the single host. If no WebSocket can be opened, the driver is no longer closed permanently, so `connect()` can be called again. A WebSocket error after the WebSocket opened still closes the driver, as before. If the WebSocket closes or fails before it opens, the driver calls `onError` once for the connection attempt; it no longer calls `onClose` in this case, because no connection was open. `onError` remains reserved for WebSocket errors: it is not called for configuration errors such as an invalid connection string.

When the login fails, the driver now closes the WebSocket and discards the unauthenticated connection instead of leaving it open.

Connection strings with a certificate fingerprint (`host/fingerprint`) are rejected with a clear error until fingerprint validation is implemented.

## Features

* #123: Added support for Exasol connection strings with host ranges, host lists and failover

## Security

* Updated `node-forge` to 1.4.3 to fix multiple vulnerabilities (e.g. GHSA-86w9-cpqp-85rv, GHSA-6qrw-m8cv-hcxf, GHSA-5cwg-6vw7-rj6p)

## Dependency Updates

### Compile Dependency Updates

* Updated `node-forge:^1.4.0` to `^1.4.3`
