# Exasol Driver ts 0.4.0, released 2026-05-??

Code name: Import local CSV File

## Summary

This release adds support for importing local CSV files into an Exasol table. See the [user guide](../user_guide/user_guide.md) for details.

The release also fixes the implementation of the `driver.cancel()` method. Before, it failed with error `Cannot read properties of undefined (reading 'numResults')`. Now the query correctly fails with the correct error message `E-EDJS-25: SQL error: code: 'R0003', message: 'Client requested execution abort. ...`.

### Compatibility

Starting with this release, we test the driver with Node.js LTS versions 22, 24 and 26. We no longer test with version 20 which is not maintained any longer.

## Features

* #48: Added import from local CSV file

## Bugfixes

* #62: Fixed cancelling `query()` and `execute()` calls

## Dependency Updates

### Development Dependency Updates

* Updated `globals:^17.5.0` to `^17.6.0`
* Updated `jest-environment-jsdom:^30.3.0` to `^30.4.1`
* Updated `rollup:^4.60.2` to `^4.60.4`
* Updated `eslint:^10.2.1` to `^10.4.0`
* Updated `@babel/preset-typescript:^7.28.5` to `^7.29.7`
* Updated `ts-jest:^29.4.9` to `^29.4.11`
* Updated `ws:^8.20.0` to `^8.21.0`
* Updated `testcontainers:^11.14.0` to `^12.0.1`
* Updated `@babel/preset-env:^7.29.2` to `^7.29.7`
* Updated `jest:^30.3.0` to `^30.4.2`
* Updated `@babel/core:^7.29.0` to `^7.29.7`
* Updated `@types/node:^25.6.0` to `^25.9.1`
* Updated `typescript-eslint:^8.59.1` to `^8.60.0`
* Removed `babel-jest:^30.3.0`
