# GH-78 Run Encrypted Browser Integration Tests in Chromium

## Goal

Run the browser basic, pool, and compression integration scenarios in a real Chromium browser using native browser WebSockets and encrypted `wss` connections to the Exasol Docker database. Add a browser-safe package entry point that excludes Node-only CSV functionality and verify the database certificate through exact per-container SPKI pinning.

## Scope

In scope:

* Add `@exasol/exasol-driver-ts/browser` with the browser-supported driver and pool API, excluding Node-only CSV import/export and TLS modules.
* Keep the WebSocket factory required for both driver and pool construction.
* Build and serve the browser entry point from a local Playwright integration-test harness.
* Keep Testcontainers orchestration and certificate extraction in Node, calculate the leaf-certificate SPKI SHA-256 pin, and launch Chromium with that exact pin.
* Keep Playwright `ignoreHTTPSErrors` disabled and ensure the pin remains test-harness-only.
* Migrate basic connection/query/cancellation, pool, and compression browser coverage from jsdom to Chromium.
* Update Jest projects, npm scripts, CI, supported Exasol Docker test versions, OpenFastTrace artifacts, user documentation, and the developer guide.

Out of scope:

* Changing production TLS configuration or certificate validation behavior.
* Adding browser support for CSV import or export.
* Testing conventional CA-chain or hostname validation in the browser harness.

## Design References

* [System Requirements](../spec/system_requirements.md)
* [Quality Requirements](../spec/design/quality_requirements.md)
* [Context and Scope](../spec/design/context_and_scope.md)
* [Building Block View](../spec/design/building_block_view.md)
* [Runtime View](../spec/design/runtime_view.md)
* [Deployment View](../spec/design/deployment_view.md)
* [Architecture Decisions](../spec/design/architecture_decisions.md)

## Strategy

Deliver the change as four independently reviewable pull requests, merged sequentially to `main`:

1. Introduce a complete browser-safe package entry point with implementation, tests, CI packaging checks, traceability, and user/developer documentation while preserving existing behavior.
2. Add and validate the Playwright browser harness and certificate pinning while retaining jsdom tests.
3. Migrate the browser integration suites to Chromium and remove the jsdom TLS bypass.
4. Complete full browser integration CI and final release metadata.

PR 2–4 must be able to consume the browser entry point produced by PR 1 without adding missing packaging, API, or documentation prerequisites.

## Task List

### PR 1: Self-contained browser-safe packaging

- [ ] Refactor the driver implementation into a browser-safe core and Node-specific CSV extensions so browser imports do not resolve CSV, filesystem, networking, or TLS modules.
- [ ] Add `src/browser.ts` exporting the browser-supported driver, pool, protocol types, errors, statements, results, logging, and WebSocket types.
- [ ] Preserve the existing Node entry point, factory-first constructor signatures, CSV APIs, and custom Node TLS behavior.
- [ ] Add browser CommonJS, ESM, and declaration outputs and the `@exasol/exasol-driver-ts/browser` package export while preserving root package compatibility.
- [ ] Add built-artifact browser bundle smoke tests proving the browser entry imports successfully and excludes Node-only modules and CSV APIs.
- [ ] Add browser and Node TypeScript coverage for public exports and explicit WebSocket-factory construction of drivers and pools.
- [ ] Update CI quality gates to run the PR 1 packaging smoke and type checks without requiring Docker or Chromium.
- [ ] Add requirements, design, implementation, unit-test, and user-manual traceability for the browser entry point and packaging boundary.
- [ ] Update the README, user guide, API documentation configuration/output, and developer guide with the browser subpath, factory-required examples, Node-only CSV limitation, entry-point distinction, and local packaging verification commands.

### PR 2: Playwright harness and TLS pinning

- [ ] Add Playwright Chromium as a development/test dependency and provision Chromium.
- [ ] Add a Node-based browser test coordinator that starts Exasol with Testcontainers, extracts the leaf certificate, computes its SPKI SHA-256 pin, serves the browser bundle, and launches Chromium.
- [ ] Fail setup when the extracted certificate or pin is missing or does not match.
- [ ] Keep `ignoreHTTPSErrors` disabled and ensure no production runtime setting receives the pin.
- [ ] Add a minimal browser smoke scenario proving native browser `WebSocket` connectivity over `wss`.

### PR 3: Browser suite migration

- [ ] Execute the existing basic connection/query/cancellation, pool, and compression scenarios inside Chromium and return serializable results to Jest.
- [ ] Use the browser package entry point and native browser `WebSocket` in all browser runners.
- [ ] Remove the jsdom TLS bypass environment and browser use of Node `ws` transport.
- [ ] Preserve Node integration coverage and certificate-chain handling.
- [ ] Add implementation and integration trace tags for the migrated scenarios.

### PR 4: Full CI and finalization

- [ ] Update Jest projects and npm scripts for the real-browser integration suites.
- [ ] Update CI to install Chromium and run browser integration tests against supported Exasol Docker versions.
- [ ] Complete the GH-78 OpenFastTrace requirements, design, implementation, and test coverage.
- [ ] Update release metadata and changelog according to the target release policy.

## Verification

- [ ] Verify the built browser bundle loads without resolving Node-only CSV/TLS modules.
- [ ] Verify both entry points construct drivers and pools with explicit factories.
- [ ] Verify existing factory-first constructor calls and custom Node TLS factories continue to work.
- [ ] Verify browser integration uses native `WebSocket` and `wss`, without `ws`, `rejectUnauthorized: false`, or `ignoreHTTPSErrors`.
- [ ] Run `npm run build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint:ci`.
- [ ] Run `npm run test`.
- [ ] Run `env -u NODE_OPTIONS npm run itest` with Docker access once the Chromium harness is introduced.
- [ ] Run `npm run trace`.
- [ ] Run `npm run audit`.

## Assumptions

- WebSocket factories remain required in PR 1; entry-point-specific default factories are not part of this PR.
- No production TLS behavior changes in PR 1.
- Playwright and Chromium are introduced in PR 2.
- Version and changelog updates remain part of the final release PR unless the release policy requires versioning each sequential PR.
