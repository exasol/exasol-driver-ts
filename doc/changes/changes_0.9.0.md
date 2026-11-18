# Exasol Driver ts 0.9.0, released 2026-??-??

Code name: Replace node-forge

## Summary

Replace node-forge and harden dependency security

Use node-rsa for browser-compatible login encryption and selfsigned for
Node-only file transfer certificates, preserving the wire protocol.

Keep credentials, SQL, and parameters out of trace callbacks, and reject
file transfer headers over 64 KiB with E-EDJS-39.

Upgrade dependencies, refresh patched transitive packages,
and document dated exceptions for the remaining upstream advisories.
Update tests and specification traceability.

## Features

* #113: Modernize Node cryptography and enforce Node/browser bundle budgets

## Dependency Updates

### Compile Dependency Updates

* Added `node-rsa:^2.0.0`
* Removed `node-forge:^1.4.0`

### Development Dependency Updates

* Updated `eslint:^10.11.0` to `^10.15.0`
* Updated `vite:^8.3.1` to `^8.3.6`
* Added `playwright:^1.65.1`
* Updated `ts-jest:^29.4.14` to `^29.4.15`
* Updated `vitest:^5.0.3` to `^5.1.0`
* Updated `@vitest/browser-playwright:^5.0.3` to `^5.1.0`
* Updated `testcontainers:^12.2.0` to `^12.2.1`
* Updated `@vitest/coverage-v8:^5.0.3` to `^5.1.0`
* Added `esbuild:^0.27.7`
* Updated `typescript-eslint:^8.71.0` to `^8.73.0`
* Removed `@types/node-forge:^1.3.14`
* Removed unused `@typescript/native:npm:typescript@^7.0.2` to keep clean installs reproducible
