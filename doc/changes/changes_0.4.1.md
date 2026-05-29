# Exasol Driver ts 0.4.1, released 2026-05-29

Code name: Drop node-forge

## Summary

Replaces `node-forge` with Node's built-in `node:crypto`, removing the dependency entirely (~313 KB off the bundle). `node:crypto` now handles both the basic-auth password encryption (RSA-PKCS1-v1.5) and the local CSV import ad-hoc TLS certificate (RSA key generation plus a self-signed X.509 certificate). The public-key fingerprint used by `IMPORT ... PUBLIC KEY` is unchanged.

`node:crypto` is Node-only, so this drops the implicit browser path; a browser build would need a WebCrypto-based implementation.

## Dependency Updates

### Compile Dependency Updates

* Removed `node-forge:^1.4.0`

### Development Dependency Updates

* Removed `@types/node-forge:^1.3.14`
