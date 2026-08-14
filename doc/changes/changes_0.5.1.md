# Exasol Driver ts 0.5.1, released 2026-??-??

Code name:

## Summary

This release fixes intermittent failures when pooled queries fetch large result sets, improves handling of network errors, and replaces idle connections that close unexpectedly.

## Bugfixes

* #82: Consume `closeResultSet` responses before reusing a pooled connection.
* #90: Reject in-flight commands on WebSocket errors or closures and replace broken pooled drivers.
* #91: Validate pooled drivers on borrow and replace drivers whose WebSockets closed while idle.
This release fixes intermittent failures when pooled queries fetch large result sets.
