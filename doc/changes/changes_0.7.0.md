# Exasol Driver ts 0.7.0, released 2026-09-??

Code name: Local Parquet import

## Summary

This release allows importing local Parquet files into an existing Exasol table with `importFromParquetFile()`. This Node.js-only API requires Exasol 2025.1.9 or later and supports cancellation through `AbortSignal`.

## Features

* #61: Import local Parquet files into an existing Exasol table

## Dependency Updates

### Development Dependency Updates

* Added `hyparquet-writer:^0.16.9`
