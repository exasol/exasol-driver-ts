# Exasol Driver ts 0.2.0, released 2024-11-13

Code name: Connection pool and logging

## Summary

Adds `ExasolPool`, which is a connection pool using `ExasolDriver` underneath. See the user guide for a new section on how to configure and use the `ExasolPool` class.
Logging is now configurable for both driver/client and pool. The defaults are now also more sensible (off). An issue with switching off logging was also resolved.

## Features

- #28: Add a connection pool.
- #34: Make log level configurable.

## Dependency Updates

### Compile Dependency Updates

* Added `generic-pool:^3.9.0`
