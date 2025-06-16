# Exasol Driver ts 0.3.1, released 2025-06-16

Code name: Minor logger update / CI tests update

## Summary

- Made logger a bit less 'verbose' when used in trace mode as it could possibly leak sensitive info in a trace statement.
- Added a better error message when handling some connection issues.
- Updated CI tests to use Exasol docker db v8 with encryption enabled in a node context:
Exasol docker db v7.1.x without encryption is used in the browser based CI tests.
Exasol docker db v8.30.x with encryption is used in the node based CI tests.
There are no Docker db v7.1.x with encryption tests currently possible due to a problem with an SSL version used in Exasol docker db v7.1.x.
To run Docker db v8 tests with encryption in a browser based context a wholly new approach will be necessary and the CI tests will need to be party re-engineered. 
Due to time constraints this will be implemented at a later date. A separate ticket has been created for this task.

## Features

* #24: Add Exasol 8 to integration test

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
