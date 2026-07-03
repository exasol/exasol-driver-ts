# Exasol Driver ts 0.4.1, released 2026-07-03

Code name: Multiple query placeholders

## Summary

A patch release with a bug fix. This release also fixes the following vulnerabilities reported by `npm audit` in transitive development dependencies:

* https://github.com/advisories/GHSA-h67p-54hq-rp68: js-yaml Quadratic-complexity DoS in merge key handling via repeated aliases
* https://github.com/advisories/GHSA-f38q-mgvj-vph7: protobufjs schema-derived names can shadow runtime-significant properties
* https://github.com/advisories/GHSA-vmh5-mc38-953g: undici TLS certificate validation bypass via dropped requestTls in SOCKS5 ProxyAgent
* https://github.com/advisories/GHSA-p88m-4jfj-68fv: undici HTTP header injection via Set-Cookie percent-decoding
* https://github.com/advisories/GHSA-vxpw-j846-p89q: undici WebSocket client vulnerable to denial of service via fragment count bypass
* https://github.com/advisories/GHSA-hm92-r4w5-c3mj: undici cross-origin request routing via SOCKS5 proxy pool reuse
* https://github.com/advisories/GHSA-pr7r-676h-xcf6: undici cross-user information disclosure via shared cache whitespace bypass

## Bugfixes

* #71: Fixed incorrect column data when query has more than one ? placeholder.

## Security

* #71: Fixed vulnerabilities in transitive development dependencies

## Dependency Updates

### Development Dependency Updates

* Updated `undici:7.25.0` to `7.28.0` (transitive dependency of `testcontainers`)
* Updated `protobufjs:7.6.1` to `7.6.4` (transitive dependency of `testcontainers`)
* Updated `js-yaml:4.1.1` to `4.3.0` (transitive dependency of `@eslint/eslintrc`)
* Updated `js-yaml:3.14.2` to `3.15.0` (transitive dependency of `ts-jest`)
