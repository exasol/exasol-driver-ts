# Exasol Driver ts 0.6.0, released 2026-??-??

Code name:

## Summary

This release improves observability of driver sessions in Exasol.

This release fixes intermittent failures when pooled queries fetch large result sets, improves handling of network errors, and replaces idle connections that close unexpectedly. Thanks to [@espenhogbakk](https://github.com/espenhogbakk) for reporting these issues!

The driver now also reports the package version automatically in session driver metadata instead of the hard-coded value `v1.0.0`.

## Features

* #46: Configure client operating-system, operating-system username, and runtime login metadata. The driver derives best-effort defaults from Node.js and browser platforms when values are not supplied.

## Bugfixes

* #82: Consume `closeResultSet` responses before reusing a pooled connection.
* #90: Reject in-flight commands on WebSocket errors or closures and replace broken pooled drivers.
* #91: Validate pooled drivers on borrow and replace drivers whose WebSockets closed while idle.

## Dependency Updates

### Development Dependency Updates

* Added `typedoc:^0.28.20`
* Added `@rollup/plugin-json:^6.1.0`
