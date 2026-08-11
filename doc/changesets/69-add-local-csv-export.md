# GH-69 Add Local CSV Export

## Goal

Allow Node.js applications to export an Exasol table or query result to a new local CSV file through a public-key-pinned TLS tunnel. The feature ships as part of version 0.5.0.

## Scope

In scope:

* Add `exportToCsvFile(source, filePath, csvOptions?, options?)` to the driver API.
* Support a table identifier or parenthesized `SELECT` query as `source`.
* Add export-specific CSV options for column separator, column delimiter, row separator, encoding, NULL representation, and column names.
* Reject an existing destination file before creating the tunnel; remove newly created partial files after failures or cancellation.
* Add requirements, design, OpenFastTrace coverage, unit tests, integration tests, user documentation, and a 0.5.0 changelog entry.

Out of scope:

* Browser support, remote destinations, overwrite modes, compression, advanced per-column formatting, and import-only `skip` or `trim` options.

## Design References

* [System Requirements](../spec/system_requirements.md)
* [Quality Requirements](../spec/design/quality_requirements.md)
* [Building Block View](../spec/design/building_block_view.md)
* [Runtime View](../spec/design/runtime_view.md)
* [Architecture Decisions](../spec/design/architecture_decisions.md)
* [Exasol EXPORT documentation](https://docs.exasol.com/db/latest/sql/export.htm)

## Strategy

The export flow reuses the ad-hoc Exasol tunnel and generated certificate from CSV import, in reverse: Exasol uploads CSV bytes through the pinned TLS connection and the driver streams them to a new local file. The public API uses a dedicated `CsvExportFormatOptions` type so callers cannot supply import-only clauses. The shared tunnel body reader accepts `Content-Length` request bodies and rejects unsupported chunked request bodies before writing any data.

Deliver the work as four dependent pull requests. Do not release the API until all four are merged.

## Task List

- [x] Create and checkout a new Git branch `feature/69-add-local-csv-export`

### PR 1: Tunnel Receive Foundation

- [x] Refactor the internal HTTP/TLS tunnel helpers to retain bytes coalesced with HTTP headers and stream incoming request bodies with backpressure.
- [x] Keep `importFromCsvFile()` behavior unchanged and retain its existing trace coverage.
- [x] Add Node unit tests for fragmented and coalesced headers/body data, supported body transfer modes, socket and write failures, and cleanup.
- [x] Add loopback-TCP integration tests for receiving headers and request bodies and sending chunked responses without socket or stream mocks.
- [x] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, and `npm run trace`.

### PR 2: Core Export API, Requirements, Design, and Tests

- [ ] Add `feat~csv-file-export~1` to the system requirements.
- [ ] Add requirements and scenarios for successful table/query export, export format options, existing-file rejection, and unsupported chunked request bodies.
- [ ] Add runtime, building-block, architecture-decision, and Node-only constraint `dsn` items for the public API, reverse TLS tunnel, SQL generation, streaming, transfer failures, existing-file protection, and unsupported chunked request bodies.
- [ ] Add `impl`, `utest`, and `itest` tags so every new runtime design item has a clean `feat -> req -> scn -> dsn -> impl/utest/itest` trace chain.
- [ ] Stop and ask the user for a review of the requirements and design.
- [ ] Add and export `CsvExportFormatOptions` (`columnSeparator`, `columnDelimiter`, `rowSeparator`, `encoding`, `null`, `withColumnNames`).
- [ ] Implement `exportToCsvFile(source, filePath, csvOptions?)` on `IExasolDriver` and `ExasolDriver`, resolving with Exasol's export row count.
- [ ] Build `EXPORT <source> INTO CSV AT '<tunnel>' PUBLIC KEY '<fingerprint>' FILE '001.csv'` with valid export clauses and escaped SQL literals.
- [ ] Reserve the resolved destination exclusively before opening the tunnel; reject an existing file with `E-EDJS-31`, retain successful output, and remove a newly-created partial file after SQL, transfer, or write failures.
- [ ] Reject `Transfer-Encoding: chunked` case-insensitively in the shared HTTP request-body reader before writing body data, with `E-EDJS-30`.
- [ ] Add Node unit tests for SQL generation, API forwarding and closed-driver behavior, existing-file protection, transfer/write failures, and chunked-request rejection.
- [ ] Add Node integration tests for table and parenthesized-query sources, format/header options, exported contents, existing-file preservation, and rejected chunked request bodies.
- [ ] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, `npm run itest`, and `npm run trace`.

### PR 3: Export Cancellation

- [ ] Add CSV export cancellation requirements, scenarios, runtime design, and trace coverage.
- [ ] Add and export `CsvExportOptions` (`signal`) and extend `exportToCsvFile(source, filePath, csvOptions?, options?)` on `IExasolDriver` and `ExasolDriver`.
- [ ] On abort, destroy file and tunnel resources, cancel the active SQL operation once started, remove the newly-created partial output file, and reject with `AbortError` using `E-EDJS-32`.
- [ ] Add Node unit tests for pre-aborted and in-flight cancellation, SQL cancellation, and output-file cleanup.
- [ ] Add Node integration tests for in-flight cancellation and partial-file removal.
- [ ] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, `npm run itest`, and `npm run trace`.

### PR 4: User Documentation and Release Notes

- [ ] Add reader-focused Node-only export guidance to `doc/user_guide/user_guide.md`, including table and query examples, CSV/header options, existing-file behavior, and cancellation.
- [ ] Place `uman` coverage tags directly before the relevant guidance; add `uman` to the documented scenarios' `Needs` lists and to the quality-requirements artifact hierarchy.
- [ ] Update `doc/changes/changes_0.5.0.md` with a GH-69 feature entry, a concise `exportToCsvFile()` example, and a link to the user guide. Do not change the version or changelog index.
- [ ] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, `npm run itest`, `npm run audit`, `npm run build`, and `npm run trace`.
