# GH-114 Validate Every Supported Package Import Route

## Goal

Fix native Node.js ESM failures caused by namespace imports of the CommonJS-only
`node-forge` dependency. Verify every public package export route from an
isolated, packed consumer installation.

## Scope

In scope:

* Replace the production `node-forge` namespace imports used by basic
  authentication and local-file import TLS setup.
* Test all four public conditional-export routes: root ESM, root CommonJS,
  browser-subpath ESM, and browser-subpath CommonJS, against a real Exasol
  database.
* Make the Playwright browser integration suite consume the built browser
  package artifact rather than an aliased source entry point.
* Update traceability and package-test documentation for this verification.

Out of scope:

* New public APIs, dependency upgrades, export-map changes, release versioning,
  and changelog preparation.

## Design References

* [System Requirements](../spec/system_requirements.md)
* [Runtime View](../spec/design/runtime_view.md)
* [Building Block View](../spec/design/building_block_view.md)
* [Architecture Decisions](../spec/design/architecture_decisions.md)
* [Deployment View](../spec/design/deployment_view.md)
* [Quality Requirements](../spec/design/quality_requirements.md)

## Strategy

The package has four supported runtime routes: `import` and `require` of the
root Node.js entry point, and `import` and `require` of the `/browser`
subpath. Docker-backed integration tests must build and pack the library,
install that tarball into a temporary consumer project, and execute each route
there against the Exasol container. Root-entry scenarios must perform both
basic authentication and a CSV import; browser-entry scenarios must perform
basic authentication and verify that Node-only file APIs are absent. Direct
`dist/` and source-file imports are not supported by the package export map.

## Task List

- [ ] Create and checkout branch `bug/114-esm-node-forge-imports`.

### Design

- [x] Revise `dsn~decision-publish-cjs-and-esm` to require packed-consumer
  integration evidence for every public conditional export route.
- [x] Update package-test quality documentation to define the packed-consumer
  verification.
- [x] Stop and request review of the design updates.

### Implementation

- [x] Change `src/lib/sql-client.ts` to default-import `node-forge` so the
  published ESM login flow accesses its runtime-generated API correctly.
- [x] Change `src/lib/import/tls-transport.ts` to default-import `node-forge`
  so ESM CSV and Parquet import certificate generation works.
- [x] Keep public APIs, dependency versions, and package export paths
  unchanged.

### Package Integration Tests

- [x] Keep `test:package` focused on built package-entry and declaration smoke
  checks; run Exasol-backed packed-consumer scenarios with `itest`.
- [x] Replace fake-WebSocket root ESM and CommonJS package fixtures with
  Docker-backed consumer scenarios that authenticate against Exasol, import a
  CSV file, and assert the imported row count or data. These scenarios must
  exercise `generateAdHocCertificate()` in the packed artifact.
- [x] Replace fake-WebSocket browser-subpath ESM and CommonJS package fixtures
  with Docker-backed consumer scenarios that authenticate against Exasol and
  verify that Node-only file methods are absent.
- [x] Register the packed-consumer scenarios in the Docker integration-test
  workflow so the package build, tarball installation, and fixture execution
  share the Exasol container and its trusted CA certificate.
- [x] Remove the Vitest source alias and build before browser integration
  tests, so Playwright executes the built `/browser` ESM artifact against
  Exasol.
- [x] Update `itest` trace tags for the Docker-backed CJS/ESM packaging and
  basic-authentication scenarios.
- [x] Add `itest` trace tags for the real local-file TLS streaming scenarios.

### Verification

- [x] Confirm the initial root-ESM fixture fails before the production import
  change with the reported `forge.jsbn` error.
- [x] Run `npm run test:package`.
- [x] Run `npm run lint:ci`, `npm run typecheck`, and `npm run trace`.
- [x] Run `npm run test`.
- [x] Run `env -u NODE_OPTIONS npm run itest` with Docker access.

## Version And Changelog Update

- [ ] No version or changelog update is part of this patch; handle release
  preparation separately.
