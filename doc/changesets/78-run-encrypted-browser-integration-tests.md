# GH-78 Run Encrypted Browser Integration Tests in Chromium

## Goal

Run the browser basic, pool, and compression integration scenarios in a real Chromium browser using native browser WebSockets and encrypted `wss` connections to the Exasol Docker database. Add a browser-safe package entry point that excludes Node-only CSV functionality and verify the database certificate through exact per-container SPKI pinning.

## Scope

In scope:

* Add `@exasol/exasol-driver-ts/browser` with the browser-supported driver and pool API, excluding Node-only CSV import/export and TLS modules.
* Make the WebSocket factory optional for both driver and pool construction, with entry-point-specific defaults while retaining explicit factory injection for custom TLS and transport configuration.
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

1. Introduce the browser-safe package entry point while preserving existing behavior.
2. Add and validate the Playwright browser harness and certificate pinning while retaining jsdom tests.
3. Migrate the browser integration suites to Chromium and remove the jsdom TLS bypass.
4. Complete CI, documentation, traceability, and release metadata.

## Task List

### PR 1: Browser-safe packaging

- [ ] Refactor the driver exports so browser imports do not resolve Node-only CSV, filesystem, networking, or TLS modules.
- [ ] Add browser CommonJS, ESM, and declaration outputs and the `@exasol/exasol-driver-ts/browser` package export.
- [ ] Preserve the existing Node entry point and CSV APIs.
- [ ] Add backward-compatible constructor overloads accepting either `(websocketFactory, config, logger?)` or `(config, logger?)` for `ExasolDriver` and `ExasolPool`.
- [ ] Implement the browser default factory with the runtime-provided global `WebSocket`.
- [ ] Implement the Node default factory with `ws`, promote `ws` to a runtime dependency, and retain explicit factories for custom CA, certificate, proxy, and TLS settings.
- [ ] Add browser bundle smoke and type coverage.
- [ ] Update requirements and design items for the browser entry point.

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

### PR 4: CI, documentation, and finalization

- [ ] Update Jest projects and npm scripts for the real-browser integration suites.
- [ ] Update CI to install Chromium and run browser integration tests against supported Exasol Docker versions.
- [ ] Update the README and user guide with browser-safe imports, optional factory usage, explicit-factory examples for custom Node TLS settings, and the Node-only CSV limitation.
- [ ] Update the developer guide with browser versus Node entry points, default WebSocket behavior, when an explicit factory is required, local browser integration prerequisites and commands, Chromium provisioning, Docker/Testcontainers requirements, certificate pinning behavior, and its test-only scope.
- [ ] Complete the GH-78 OpenFastTrace requirements, design, implementation, and test coverage.
- [ ] Update release metadata and changelog according to the target release policy.

## Verification

- [ ] Verify the browser bundle loads in Chromium without resolving Node-only CSV/TLS modules.
- [ ] Verify both entry points construct drivers and pools without an explicit factory and use their documented defaults.
- [ ] Verify existing factory-first constructor calls remain source-compatible and custom Node TLS factories continue to work.
- [ ] Verify browser tests fail when the certificate pin is absent or mismatched.
- [ ] Verify browser integration uses native `WebSocket` and `wss`, without `ws`, `rejectUnauthorized: false`, or `ignoreHTTPSErrors`.
- [ ] Run `npm run build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint:ci`.
- [ ] Run `npm run test`.
- [ ] Run `env -u NODE_OPTIONS npm run itest` with Docker access.
- [ ] Run `npm run trace`.
- [ ] Run `npm run audit`.
