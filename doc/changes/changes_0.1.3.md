# Exasol Driver ts 0.1.3, released 2024-02-05

Code name: Fix bable traverse and jsrsasign vulnerabilities.

## Summary

This release fixes vulnerabilities in bable traverse by updating the package and swaps out jsrsasign with node-forge to replace RSA encryption.

## Features

- #26: Fix vulnerabilities

## Dependency Updates

### Compile Dependency Updates

* Added `node-forge:^1.3.1`
* Removed `jsrsasign:^10.8.6`

### Development Dependency Updates

* Added `@types/node-forge:^1.3.11`
* Removed `@types/jsrsasign:^10.5.8`
