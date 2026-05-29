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
- `constr~injectable-websocket-implementation~1`
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

Needs: impl

Tags: pooling, dependency

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

## Packaging

### Build CommonJS and ES Module Outputs

The package provides both CommonJS and ES module entry points.

Considered alternatives:

1. Publish only CommonJS.
2. Publish only ES modules.
3. Publish both formats.

#### Publish CJS and ESM
`dsn~decision-publish-cjs-and-esm~1`

The system builds CommonJS and ES module outputs from the same TypeScript entry point.

Rationale:

This improves compatibility with different consuming application build systems.

Covers:
- `constr~typescript-library-package~1`

Needs: impl

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
