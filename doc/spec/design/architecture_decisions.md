# Architecture Decisions

This chapter records important architectural decisions and their rationale.

## Runtime Abstraction

### Inject WebSocket Implementation

The library accepts a WebSocket factory instead of importing one concrete implementation. This keeps the core driver usable in browser and Node.js runtimes.

Considered alternatives:

1. Import browser `WebSocket` directly.
2. Depend on the Node.js `ws` package directly.
3. Accept an application-provided WebSocket factory.

#### Use WebSocket Factory
`dsn~decision-use-websocket-factory~1`

The system uses an injected WebSocket factory as the runtime abstraction for database connections.

Rationale:

This supports the documented browser and Node.js usage model and avoids forcing one runtime's WebSocket implementation onto all consumers.

Covers:
- `constr~injectable-websocket-implementation~2`
- `constr~browser-and-nodejs-runtime-support~1`

Tags: runtime, portability

## Pooling

### Reuse generic-pool

The pool API delegates pooling mechanics to `generic-pool` and keeps Exasol-specific logic in `ExasolDriver`.

Considered alternatives:

1. Hand-write pool scheduling and lifecycle management.
2. Reuse `generic-pool`.

#### Use generic-pool
`dsn~decision-use-generic-pool~1`

The system uses `generic-pool` for connection pool lifecycle and capacity management.

Rationale:

Pooling is a general-purpose concern. Reusing an existing library keeps the Exasol-specific code focused on driver behavior.

Covers:
- `scn~pool-reuses-drivers-for-queries~1`
- `scn~pool-enforces-configured-size-limits~1`
- `scn~pool-shutdown~1`
- `scn~replace-idle-closed-pooled-driver~1`

Needs: impl

Tags: runtime, portability, pooling, dependency

## CSV Import

### Use Exasol Import Tunnel

The CSV import implementation streams a local file to Exasol through an import tunnel instead of reading the whole file into memory.

Considered alternatives:

1. Build one SQL statement containing file contents.
2. Read the entire file into memory before sending.
3. Stream the file through Exasol's import tunnel.

#### Stream CSV Through Import Tunnel
`dsn~decision-stream-csv-through-import-tunnel~1`

The system imports local CSV files by opening an Exasol import tunnel and streaming the file as chunked HTTP response data.

Rationale:

Streaming supports larger files and matches Exasol's `IMPORT FROM CSV AT ... FILE ...` mechanism.

Covers:
- `scn~csv-import-succeeds~1`
- `constr~node-only-csv-import~1`

Needs: impl

Tags: csv-import, nodejs

## CSV Export

### Use Exasol Export Tunnel

The CSV export implementation streams data from Exasol to a new local file through an export tunnel instead of buffering the complete result in memory.

Considered alternatives:

1. Read the exported result through the WebSocket SQL protocol.
2. Buffer the complete exported CSV in memory before writing.
3. Stream the export through Exasol's export tunnel.

#### Stream CSV Through Export Tunnel
`dsn~decision-stream-csv-through-export-tunnel~1`

The system exports local CSV files by opening an Exasol export tunnel and streaming Exasol's content-length-delimited or chunked HTTP request body into a newly reserved file.

Rationale:

Streaming supports larger files and matches Exasol's `EXPORT ... INTO CSV AT ... FILE ...` mechanism while avoiding an overwrite race at the local destination.

Covers:
- `scn~csv-export-table-succeeds~1`
- `scn~csv-export-query-succeeds~1`
- `scn~csv-export-rejects-existing-destination~1`
- `constr~node-only-csv-export~1`

Needs: impl

Tags: csv-export, nodejs

### How to Select the Compression Format?

The CSV export implementation uses the local destination files extension to select Exasol's export compression format.

Example: destination file name `export.csv.gz` selects `.gz` compression.

Considered alternatives:

1. Add a separate public compression option.
2. Infer the format from the destination extension.

#### Use the Destination Extension for Compression
`dsn~decision-select-csv-export-compression~1`

The CSV export maps destination file extensions `.zip`, `.gz`, and `.bz2` case-insensitively to Exasol remote filenames `001.zip`, `001.gz`, and `001.bz2`; all other destinations use `001.csv`.

Rationale:

Exasol selects the export compression format from the `FILE` name. Reusing the local extension avoids expanding the public driver API and preserves uncompressed export behavior.

Covers:
- `scn~csv-export-compressed-file-succeeds~1`
- `constr~node-only-csv-export~1`

Needs: impl

Tags: csv-export, compression, nodejs

## Packaging

### Build CommonJS and ES Module Outputs

The package provides both CommonJS and ES module entry points.

Considered alternatives:

1. Publish only CommonJS.
2. Publish only ES modules.
3. Publish both formats.

#### Publish CJS and ESM
`dsn~decision-publish-cjs-and-esm~2`

The system builds CommonJS and ES module outputs for separate Node.js and browser entry points.

Rationale:

This improves compatibility with different consuming application build systems.

Covers:
- `constr~typescript-library-package~1`

Needs: impl, utest

Tags: packaging

### Publish Through GitHub Release Workflow
`dsn~decision-use-github-release-workflow-for-npm-publishing~1`

The system publishes the npm package from the GitHub release workflow after quality gates, package build, and package packing succeed.

Rationale:

Publishing from a dedicated release workflow keeps distribution tied to GitHub releases and uses npm publishing credentials only in the release job.

Covers:
- `constr~github-and-npm-distribution~1`

Tags: packaging, release

## Open Issues
