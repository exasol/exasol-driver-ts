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
  browser-subpath ESM, and browser-subpath CommonJS.
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
* [Deployment View](../spec/design/deployment_view.md)
* [Quality Requirements](../spec/design/quality_requirements.md)

## Strategy

The package has four supported runtime routes: `import` and `require` of the
root Node.js entry point, and `import` and `require` of the `/browser`
subpath. Package tests must build and pack the library, install that tarball
into a temporary consumer project, and execute each route there. Direct
`dist/` and source-file imports are not supported by the package export map.

## Task List

- [ ] Create and checkout branch `bug/114-esm-node-forge-imports`.

### Requirements And Design

- [ ] Revise `dsn~runtime-packaging` to state that all conditional export
  routes are verified from an isolated packed-package consumer and add its
  integration-test need.
- [ ] Update package-test quality documentation to define the packed-consumer
  verification.
- [ ] Stop and request review of the design updates.

### Implementation

- [ ] Change `src/lib/sql-client.ts` to default-import `node-forge` so the
  published ESM login flow accesses its runtime-generated API correctly.
- [ ] Change `src/lib/import/tls-transport.ts` to default-import `node-forge`
  so ESM CSV and Parquet import certificate generation works.
- [ ] Keep public APIs, dependency versions, and package export paths
  unchanged.

### Package Integration Tests

- [ ] Extend `test:package` to build, create an npm tarball in a temporary
  directory, install it into a temporary consumer project, and run checked-in
  consumer fixtures there.
- [ ] Add a root ESM consumer fixture that completes basic-auth login using a
  fake WebSocket and completes a local CSV import using a local TCP/TLS tunnel
  peer.
- [ ] Add the same root CommonJS consumer fixture.
- [ ] Add browser-subpath ESM and CommonJS consumer fixtures that complete
  basic-auth login and verify that Node-only file methods are absent.
- [ ] Remove the Vitest source alias and build before browser integration
  tests, so Playwright executes the built `/browser` ESM artifact against
  Exasol.
- [ ] Add `itest` trace tags for runtime packaging, basic authentication, and
  local-file TLS streaming.

### Verification

- [ ] Confirm the new root-ESM fixture fails before the production import
  change with the reported `forge.jsbn` error.
- [ ] Run `npm run test:package`.
- [ ] Run `npm run lint:ci`, `npm run typecheck`, `npm run test`, and
  `npm run trace`.
- [ ] Run `env -u NODE_OPTIONS npm run itest` with Docker access.

## Version And Changelog Update

- [ ] No version or changelog update is part of this patch; handle release
  preparation separately.
