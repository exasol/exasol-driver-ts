# Exasol Driver ts 0.5.1, released 2026-??-??

Code name:

## Summary

This release fixes intermittent failures when pooled queries fetch large result sets.

## Bugfixes

* #82: Consume `closeResultSet` responses before reusing a pooled connection.
