# Exasol Driver ts 0.3.3, released 2026-05-05

Code name: Fix vulnerabilities in dependencies

## Summary

This release fixes the following vulnerability reported by dependabot:
* https://github.com/exasol/exasol-driver-ts/security/dependabot/63: Arbitrary code execution in protobufjs

Please note that the following vulnerability in a transitive test dependency is not fixed:
* https://github.com/exasol/exasol-driver-ts/security/dependabot/64: uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided

## Security

* #53: Fix vulnerabilities in dependencies

## Dependency Updates

### Development Dependency Updates

* Updated `globals:^17.4.0` to `^17.5.0`
* Updated `rollup:^4.60.1` to `^4.60.2`
* Updated `eslint:^10.1.0` to `^10.2.1`
* Updated `eslint-plugin-jest:^29.15.1` to `^29.15.2`
* Updated `testcontainers:^11.13.0` to `^11.14.0`
* Updated `prettier:^3.8.1` to `^3.8.3`
* Updated `@types/node:^25.5.0` to `^25.6.0`
* Added `audit-ci:^7.1.0`
* Updated `typescript-eslint:^8.58.0` to `^8.59.1`
