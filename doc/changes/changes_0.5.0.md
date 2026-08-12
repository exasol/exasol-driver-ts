# Exasol Driver ts 0.5.0, released 2026-??-??

Code name:

## Summary

This release upgrades dependencies and runtime environment.

The driver now supports TypeScript's automatic resource management with `await using`:

```ts
await using driver = new ExasolDriver(websocketFactory, config);
await driver.connect();
// The driver is closed automatically when this scope exits.
```

This release also fixes fetch commands to use the configured fetch size and increases the default fetch size to 1 MiB. Thanks to [@espenhogbakk](https://github.com/espenhogbakk) for reporting this!

### Breaking Changes

* TypeScript upgraded from 5.9.3 to 7.0.2
* TypeScript configuration:
  * `target` changed from `ES5` to `ES6`
  * `moduleResolution` changed from `node` to `bundler`
* Exasol v7.1 is no longer supported.
* The driver now only supports encrypted connections. Unencrypted connections are no longer supported.
  * The `encryption` field of interface `Config` is now deprecated and no longer evaluated.

## Features

* #73: Added TypeScript `await using` support for drivers, prepared statements, and connection pools.
* #68: Added `AbortSignal` cancellation for local CSV imports.

## Bugfixes

* #83: Fixed fetch commands to use the configured fetch size

## Dependency Updates

### Compile Dependency Updates

* Updated `pako:^2.1.0` to `^3.0.1`

### Development Dependency Updates

* Updated `@types/pako:^2.0.4` to `^3.0.0`
* Added `@typescript/native:npm:typescript@^7.0.2`
* Updated `globals:^17.6.0` to `^17.9.0`
* Updated `rollup:^4.60.4` to `^4.62.4`
* Updated `eslint:^10.4.0` to `^10.8.1`
* Updated `ts-jest:^29.4.11` to `^29.4.12`
* Updated `eslint-plugin-jest:^29.15.2` to `^29.16.0`
* Updated `typescript:^5.9.3` to `npm:@typescript/typescript6@^6.0.2`
* Updated `ws:^8.21.0` to `^8.21.3`
* Updated `testcontainers:^12.0.1` to `^12.1.0`
* Updated `prettier:^3.8.3` to `^3.9.6`
* Updated `@eslint/eslintrc:^3.3.5` to `^3.3.6`
* Updated `@types/node:^25.9.1` to `^26.2.0`
* Updated `typescript-eslint:^8.60.0` to `^8.66.0`
