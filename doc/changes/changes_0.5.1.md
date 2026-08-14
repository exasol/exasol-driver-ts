# Exasol Driver ts 0.5.1, released 2026-??-??

Code name:

## Summary

## Bugfixes

* #82: Consume `closeResultSet` responses before reusing a pooled connection.
* #90: Reject in-flight commands on WebSocket errors or closures and replace broken pooled drivers.
This release fixes intermittent failures when pooled queries fetch large result sets.
