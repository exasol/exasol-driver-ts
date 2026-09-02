# GH-61 Add Local Parquet Import

## Goal

Allow Node.js applications to import a local Parquet file into an Exasol table by streaming its original bytes through an encrypted import tunnel. The feature requires Exasol 2026.1 or later and ships in version 0.7.0.

## Scope

In scope:

* Add `importFromParquetFile(tableName, filePath, options?)` with `AbortSignal` cancellation.
* Reuse the existing local-file import tunnel flow for CSV and Parquet files.
* Add traced requirements, design, tests, user documentation, and release notes.

Out of scope:

* `IMPORT FROM LOCAL PARQUET` WebSocket protocol support (#47).
* Parquet parsing, conversion, schema inference, table creation, format options, or new dependencies.

## Design References

* [System Requirements](../spec/system_requirements.md)
* [Quality Requirements](../spec/design/quality_requirements.md)
* [Building Block View](../spec/design/building_block_view.md)
* [Runtime View](../spec/design/runtime_view.md)

## Strategy

Deliver the work in two independently green pull requests. PR 1 is an internal, behavior-preserving refactor. PR 2 adds the public API and its complete trace chain. Integration tests generate their small Parquet input in the test temporary directory; no generated Parquet file is checked in.

## Task List

### PR 1: Shared Local-File Import Refactor

- [x] Extract the CSV file-read, tunnel, TLS, chunked-response, cleanup, and cancellation lifecycle into a format-neutral internal helper.
- [x] Preserve `importFromCsvFile()` behavior, public API, SQL, documentation, and error messages.
- [x] Adapt the existing CSV unit tests to cover the shared helper through the CSV API.
- [x] Run `npm run trace`, `npm run lint:ci`, `npm run typecheck`, `npm run test`, `env -u NODE_OPTIONS npm run itest`, `npm run audit`, and `npm run build`.

### PR 2: Native Parquet Import

- [x] Add Parquet feature, requirements, success and cancellation scenarios, Node-only constraint, runtime and component design items, and user-manual trace coverage.
- [x] Add `FileImportOptions` while retaining `CsvImportOptions` as a compatible alias.
- [x] Add `importFromParquetFile()` to `IExasolDriver` and `ExasolDriver`.
- [x] Generate `IMPORT INTO <table> FROM PARQUET AT '<tunnel>' PUBLIC KEY '<fingerprint>' FILE '001.parquet'` and stream the source bytes through the shared helper.
- [x] Add unit coverage for Parquet SQL, API forwarding, missing files, cleanup, and cancellation using `E-EDJS-37`.
- [x] Generate a valid minimal Parquet file at runtime in the integration-test temporary directory; verify imported rows on Exasol 2026.1 and verify Exasol's helpful version-support error on older encrypted-import test images.
- [x] Update README, user guide, requirements, design, version 0.7.0, `doc/changes/changes_0.7.0.md`, and the changelog index.
- [ ] Run `npm run trace`, `npm run lint:ci`, `npm run typecheck`, `npm run test`, `env -u NODE_OPTIONS npm run itest`, `npm run audit`, and `npm run build`.
