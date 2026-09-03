# Exasol Driver ts 1.0.0, released 2026-??-??

Code name:

## Summary

This release adds the browser-safe `@exasol/exasol-driver-ts/browser` entry point. It uses the browser's native `WebSocket` implementation and exports the driver and pool APIs without Node.js-only CSV file, filesystem, networking, or TLS functionality. Use the package root for Node.js applications and the `/browser` subpath for browser applications.

The package is now explicitly configured as an ES module package while continuing to provide CommonJS entry points.

## Breaking Changes

* The package now declares `"type": "module"` in `package.json`. Consumers using CommonJS can continue to use `require('@exasol/exasol-driver-ts')`; the package routes that request to `.cjs` files. Applications that import generated files directly must update CommonJS paths from `dist/index.js` and `dist/browser.js` to `dist/index.cjs` and `dist/browser.cjs`.

## Features

* #78: Added the browser-safe `@exasol/exasol-driver-ts/browser` entry point

## Dependency Updates

### Compile Dependency Updates

* Added `ws:^8.21.3`

### Development Dependency Updates

* Removed `ws:^8.21.3`
