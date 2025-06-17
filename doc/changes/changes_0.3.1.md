# Exasol Driver ts 0.3.1, released 2025-06-17

Code name: Minor logger update / CI tests update

## Summary

- Reduced logger verbosity in trace mode to prevent potential leakage of sensitive information in trace statements.
- Improved error messages for certain connection issues.
- Updated CI tests to use Exasol Docker DB v8 with encryption enabled in Node.js context:
  - **Browser-based CI tests** use Exasol Docker DB v7.1.x **without** encryption.
  - **Node-based CI tests** use Exasol Docker DB v8.30.x **with** encryption.
- Currently, encryption testing is **not possible** with Exasol Docker DB v7.1.x due to incompatibilities with its SSL version.
- Enabling encryption in browser-based CI tests using Docker DB v8 will require a completely new approach. CI test infrastructure will need to be partially re-engineered to support this.
- Due to time constraints this will be implemented at a later date. A separate ticket has been created for this task.

## Features

* #21: Add Exasol 8 to integration test

## Dependency Updates

### Development Dependency Updates

* Added `babel-jest:^29.7.0`
* Added `@babel/preset-typescript:^7.27.1`
* Updated `testcontainers:9.1.3` to `^10.27.0`
* Added `@types/tar-stream:^3.1.3`
* Added `@babel/preset-env:^7.27.2`
* Added `@babel/core:^7.27.4`
* Added `@types/node:^22.15.21`
* Removed `@trendyol/jest-testcontainers:^2.1.1`
