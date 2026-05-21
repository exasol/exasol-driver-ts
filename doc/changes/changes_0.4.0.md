# Exasol Driver ts 0.4.0, released 2026-05-??

Code name:

## Summary

This release fixes the implementation of the `driver.cancel()` method. Before, it failed with error `Cannot read properties of undefined (reading 'numResults')`. Now the query correctly fails with the correct error message `E-EDJS-25: SQL error: code: 'R0003', message: 'Client requested execution abort. ...`.

## Bugfixes

* #62: Fixed cancelling `query()` and `execute()` calls

## Dependency Updates

### Development Dependency Updates

* Updated `globals:^17.5.0` to `^17.6.0`
* Updated `jest-environment-jsdom:^30.3.0` to `^30.4.1`
* Updated `rollup:^4.60.2` to `^4.60.4`
* Updated `eslint:^10.2.1` to `^10.4.0`
* Updated `babel-jest:^30.3.0` to `^30.4.1`
* Updated `ws:^8.20.0` to `^8.20.1`
* Updated `@babel/preset-env:^7.29.2` to `^7.29.5`
* Updated `jest:^30.3.0` to `^30.4.2`
* Updated `@types/node:^25.6.0` to `^25.8.0`
* Updated `typescript-eslint:^8.59.1` to `^8.59.3`
