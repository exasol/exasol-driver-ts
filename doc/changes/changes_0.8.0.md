# Exasol Driver ts 0.8.0, released 2026-09-08

Code name: Browser Entry Point

## Summary

This release adds a browser-safe package entry point for applications that connect to Exasol from a browser. Import `@exasol/exasol-driver-ts/browser` to use the driver and connection-pool APIs with the runtime-native `WebSocket` implementation.

The browser entry point excludes the Node.js-only local CSV and Parquet import and CSV export APIs. Both the Node.js and browser entry points require an explicit WebSocket factory.

## Features

* #78: Added the browser-safe `@exasol/exasol-driver-ts/browser` package entry point.
