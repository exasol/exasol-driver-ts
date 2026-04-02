# Exasol Driver ts 0.3.2, released 2026-??-??

Code name: Upgrade dependencies on top of 0.3.1

## Summary

This release migrates the release process to [trusted publishing](https://docs.npmjs.com/trusted-publishers). This improves security of the release process by avoiding tokens. Starting with this release, the driver is not tested against deprecated NodeJS version 16 and 18. Instead NodeJS version 22 and 24 are now supported. The release also upgrades dependencies.

## Security

* #49: Migrated npm release process to trusted publishing

## Dependency Updates

### Compile Dependency Updates

* Updated `node-forge:^1.3.1` to `^1.4.0`

### Development Dependency Updates

* Updated `@types/pako:^2.0.3` to `^2.0.4`
* Updated `eslint-config-prettier:^9.0.0` to `^10.1.8`
* Added `globals:^17.4.0`
* Updated `jest-environment-jsdom:^29.6.4` to `^30.3.0`
* Updated `rollup:^3.28.1` to `^4.60.1`
* Updated `eslint:^8.48.0` to `^10.1.0`
* Updated `babel-jest:^29.7.0` to `^30.3.0`
* Updated `@babel/preset-typescript:^7.27.1` to `^7.28.5`
* Updated `ts-jest:^29.1.1` to `^29.4.9`
* Updated `@types/jest:^29.5.4` to `^30.0.0`
* Updated `@types/node-forge:^1.3.11` to `^1.3.14`
* Updated `eslint-plugin-jest:^27.2.3` to `^29.15.1`
* Updated `typescript:^5.2.2` to `^5.9.3`
* Updated `ws:^8.17.1` to `^8.20.0`
* Updated `testcontainers:^10.27.0` to `^11.13.0`
* Updated `@types/ws:^8.5.5` to `^8.18.1`
* Updated `@types/tar-stream:^3.1.3` to `^3.1.4`
* Updated `@babel/preset-env:^7.27.2` to `^7.29.2`
* Updated `@rollup/plugin-typescript:^11.1.3` to `^12.3.0`
* Updated `jest:^29.6.4` to `^30.3.0`
* Updated `ts-node:^10.9.1` to `^10.9.2`
* Updated `prettier:^3.0.2` to `^3.8.1`
* Added `@eslint/js:^10.0.1`
* Updated `@babel/core:^7.27.4` to `^7.29.0`
* Added `@eslint/eslintrc:^3.3.5`
* Updated `@types/node:^22.15.21` to `^25.5.0`
* Added `typescript-eslint:^8.58.0`
* Updated `tslib:^2.6.2` to `^2.8.1`
* Removed `eslint-plugin-promise:^6.1.1`
* Removed `eslint-config-standard-with-typescript:^39.0.0`
* Removed `eslint-plugin-import:^2.28.1`
* Removed `eslint-plugin-n:^16.0.2`
* Removed `@typescript-eslint/eslint-plugin:^6.5.0`
* Removed `@typescript-eslint/parser:^6.5.0`
