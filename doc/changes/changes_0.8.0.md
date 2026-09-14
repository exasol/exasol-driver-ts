# Exasol Driver ts 0.8.0, released 2026-09-??

Code name: Browser Entry Point

## Summary

This release adds a browser-safe package entry point for applications that connect to Exasol from a browser. Import `@exasol/exasol-driver-ts/browser` to use the driver and connection-pool APIs with the browser-internal `WebSocket` implementation.

The browser entry point excludes the Node.js-only local CSV and Parquet import and CSV export APIs. Both the Node.js and browser entry points require an explicit WebSocket factory.

We also added browser based integration tests to ensure that the driver also works in a browser environment.

This release also hardens per-connection WebSocket command-response handling. Response-producing protocol commands are serialized, preventing response mix-ups during concurrent work; malformed response frames now safely break and discard the affected connection.

## Features

* #78: Added the browser-safe `@exasol/exasol-driver-ts/browser` package entry point and browser based integration tests

## Bug Fixes

* #93: Hardened WebSocket command-response handling through per-connection serialization

## Dependency Updates

### Development Dependency Updates

* Added `vite:^7.3.6`
* Added `vitest:^4.1.11`
* Added `@vitest/browser-playwright:^4.1.11`
* Added `@vitest/coverage-v8:^4.1.11`
