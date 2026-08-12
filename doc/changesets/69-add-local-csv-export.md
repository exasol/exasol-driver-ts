# GH-69 Add Local CSV Export

## Goal

Allow Node.js applications to export an Exasol table or query result to a new local CSV file through a public-key-pinned TLS tunnel. The feature ships as part of version 0.5.0.

## Scope

In scope:

* Add `exportToCsvFile(source, filePath, csvOptions?, options?)` to the driver API.
* Support a table identifier or parenthesized `SELECT` query as `source`.
* Add export-specific CSV options for column separator, column delimiter, row separator, encoding, NULL representation, and column names.
* Support compressed local CSV exports to `.zip`, `.gz`, and `.bz2` destination files.
* Reject an existing destination file before creating the tunnel; remove newly created partial files after failures or cancellation.
* Add requirements, design, OpenFastTrace coverage, unit tests, integration tests, user documentation, and a 0.5.0 changelog entry.

Out of scope:

* Browser support, remote destinations, overwrite modes, advanced per-column formatting, and import-only `skip` or `trim` options.

## Design References

* [System Requirements](../spec/system_requirements.md)
* [Quality Requirements](../spec/design/quality_requirements.md)
* [Building Block View](../spec/design/building_block_view.md)
* [Runtime View](../spec/design/runtime_view.md)
* [Architecture Decisions](../spec/design/architecture_decisions.md)
* [Exasol EXPORT documentation](https://docs.exasol.com/db/latest/sql/export.htm)

## Strategy

The export flow reuses the ad-hoc Exasol tunnel and generated certificate from CSV import, in reverse: Exasol uploads CSV bytes through the pinned TLS connection and the driver streams them to a new local file. The public API uses a dedicated `CsvExportFormatOptions` type so callers cannot supply import-only clauses. The shared tunnel body reader decodes both `Content-Length` and chunked request bodies before writing payload data.

Deliver the work as five dependent pull requests. Do not release the API until all five are merged.

## Task List

- [x] Create and checkout a new Git branch `feature/69-add-local-csv-export`

### PR 1: Tunnel Receive Foundation

- [x] Refactor the internal HTTP/TLS tunnel helpers to retain bytes coalesced with HTTP headers and stream incoming request bodies with backpressure.
- [x] Keep `importFromCsvFile()` behavior unchanged and retain its existing trace coverage.
- [x] Add Node unit tests for fragmented and coalesced headers/body data, supported body transfer modes, socket and write failures, and cleanup.
- [x] Add loopback-TCP integration tests for receiving headers and request bodies and sending chunked responses without socket or stream mocks.
- [x] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, and `npm run trace`.

### PR 2: Core Export API, Requirements, Design, and Tests

- [x] Add `feat~csv-file-export~1` to the system requirements.
- [x] Add requirements and scenarios for successful table/query export, export format options, existing-file rejection, and chunked request bodies.
- [x] Add runtime, building-block, architecture-decision, and Node-only constraint `dsn` items for the public API, reverse TLS tunnel, SQL generation, streaming, transfer failures, existing-file protection, and chunked request bodies.
- [x] Add `impl`, `utest`, and `itest` tags so every new runtime design item has a clean `feat -> req -> scn -> dsn -> impl/utest/itest` trace chain.
- [x] Stop and ask the user for a review of the requirements and design.
- [x] Add and export `CsvExportFormatOptions` (`columnSeparator`, `columnDelimiter`, `rowSeparator`, `encoding`, `null`, `withColumnNames`).
- [x] Implement `exportToCsvFile(source, filePath, csvOptions?)` on `IExasolDriver` and `ExasolDriver`, resolving with Exasol's export row count.
- [x] Build `EXPORT <source> INTO CSV AT '<tunnel>' PUBLIC KEY '<fingerprint>' FILE '001.csv'` with valid export clauses and escaped SQL literals.
- [x] Reserve the resolved destination exclusively before opening the tunnel; reject an existing file with `E-EDJS-30`, retain successful output, and remove a newly-created partial file after SQL, transfer, or write failures.
- [x] Decode `Transfer-Encoding: chunked` case-insensitively in the shared HTTP request-body reader before forwarding payload data.
- [x] Add Node unit tests for SQL generation, API forwarding and closed-driver behavior, existing-file protection, transfer/write failures, and chunked-request decoding.
- [x] Add Node integration tests for table and parenthesized-query sources, format/header options, exported contents, existing-file preservation, and chunked request bodies.
- [x] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, `npm run itest`, and `npm run trace`.

### Follow-up: Chunked Body Decoder Complexity

- [x] Refactor the private implementation of `decodeChunkedHttpBody()` into a stateful decoder class that holds the input iterator, buffered bytes, and remaining payload length in fields; keep the exported async-generator signature and streamed payload behavior unchanged.
- [x] Extract focused private methods for reading a chunk header, yielding available payload, validating and consuming the payload terminator, and consuming final trailers so the method SonarCloud reports is at or below cognitive complexity 15.
- [x] Preserve chunk extensions, fragmented input handling, trailers, and existing `E-EDJS-32` through `E-EDJS-35` errors without allocating new error codes or changing traceability artifacts.
- [x] Keep or extend `chunked-http-body.spec.node.ts` to cover fragmented chunk headers and payloads, chunk extensions, trailers, invalid chunk sizes, a missing terminator, incomplete bodies, and incomplete trailers.
- [x] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, and `npm run trace`; confirm the SonarCloud cognitive-complexity finding is resolved in the subsequent analysis.

### PR 3: Export Cancellation

- [x] Add CSV export cancellation requirements, scenarios, runtime design, and trace coverage.
- [x] Add and export `CsvExportOptions` (`signal`) and extend `exportToCsvFile(source, filePath, csvOptions?, options?)` on `IExasolDriver` and `ExasolDriver`.
- [x] On abort, destroy file and tunnel resources, cancel the active SQL operation once started, remove the newly-created partial output file, and reject with `AbortError` using `E-EDJS-31`.
- [x] Add Node unit tests for pre-aborted and in-flight cancellation, SQL cancellation, and output-file cleanup.
- [x] Add Node integration tests for in-flight cancellation and partial-file removal.
- [x] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, `npm run itest`, `npm run audit`, `npm run build`, and `npm run trace`.

### PR 4: Compressed Local CSV Export

- [ ] Add requirements and scenarios for exporting compressed local CSV files with `.zip`, `.gz`, and `.bz2` destination extensions.
- [ ] Add runtime, building-block, architecture-decision, and Node-only constraint `dsn` items for selecting Exasol's compressed export file name from the destination extension and streaming the resulting compressed bytes unchanged to the local file.
- [ ] Add `impl`, `utest`, `itest`, and `uman` trace coverage for the compressed-export scenarios; include `uman` in the quality-requirements artifact hierarchy.
- [ ] Stop and ask the user for a review of the requirements and design.
- [ ] Derive the Exasol export `FILE` name from the local destination's supported compression extension, preserving the existing uncompressed `.csv` behavior.
- [ ] Add Node unit tests for `.zip`, `.gz`, `.bz2`, and uncompressed SQL file-name selection.
- [ ] Add Docker-backed Node integration tests for `.zip`, `.gz`, and `.bz2` exports, verifying that Exasol produces the requested compressed file and that its decompressed CSV content is complete.
- [ ] Extend the reader-focused Node export guidance with compressed-file examples and the supported extensions; add the corresponding inline `uman` coverage tags.
- [ ] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, `npm run itest`, `npm run audit`, `npm run build`, and `npm run trace`.

### PR 5: User Documentation and Release Notes

- [ ] Add reader-focused Node-only export guidance to `doc/user_guide/user_guide.md`, including table and query examples, CSV/header options, existing-file behavior, and cancellation.
- [ ] Place `uman` coverage tags directly before the relevant guidance; add `uman` to the documented scenarios' `Needs` lists and to the quality-requirements artifact hierarchy.
- [ ] Update `doc/changes/changes_0.5.0.md` with a GH-69 feature entry, a concise `exportToCsvFile()` example, and a link to the user guide. Do not change the version or changelog index.
- [ ] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, `npm run itest`, `npm run audit`, `npm run build`, and `npm run trace`.
