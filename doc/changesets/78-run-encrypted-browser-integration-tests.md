# GH-78 Run encrypted browser integration tests in a real browser

## Goal

Verify the browser entry point against Exasol through Chromium's native WebSocket implementation over encrypted `wss` connections.

## Scope

In scope:

* Vitest Browser Mode integration tests for the existing basic, pool, and compression scenarios.
* Reuse the existing basic, pool, and compression scenario bodies and assertions through browser-safe, parameterized test helpers; move only their Node/Docker lifecycle and WebSocket-factory concerns out of browser-executed code.
* Dedicated browser test files that import the browser entry point and invoke those scenario helpers with Vitest's Jest-like `test` and `expect` assertions in Chromium, with Playwright used only as Vitest's Chromium provider.
* Node global setup that provisions Exasol and provides serializable connection data to browser tests.
* CI Chromium provisioning and Vitest browser-test configuration.
* Traceability updates for real-browser verification.

Out of scope:

* Changing the existing public browser entry point or adding browser CSV support.
* Production TLS configuration, CA-store setup, hostname validation, or certificate-pin verification.

## Design References

* [System Requirements](../spec/system_requirements.md)
* [Runtime View](../spec/design/runtime_view.md)
* [Building Block View](../spec/design/building_block_view.md)
* [Architecture Decisions](../spec/design/architecture_decisions.md)
* [Quality Requirements](../spec/design/quality_requirements.md)

## Strategy

Use Vitest Browser Mode with its Playwright provider to import dedicated browser test files through Vite and execute their `test` and `expect` calls in Chromium. Refactor the existing shared scenarios only enough to separate browser-safe SQL/assertion logic from Node-only Testcontainers lifecycle, certificate handling, and factory setup; do not duplicate the scenario coverage in a Node browser harness. Use Node global setup to manage the Exasol container and provide serializable connection settings to browser tests. Browser wrappers import `@exasol/exasol-driver-ts/browser` and supply the native `WebSocket` factory. Accept Vitest's forced `ignoreHTTPSErrors: true`: the suite verifies native-browser WebSocket behavior and encrypted transport, but does not authenticate the database certificate.

## Task List

### Requirements And Design

- [ ] Revise the browser-native-WebSocket scenario and runtime design to specify Chromium-backed Vitest verification and its accepted certificate-validation limitation.
- [ ] Add an architecture decision that selects Vitest Browser Mode with its Playwright provider over the previously planned standalone Playwright harness, recording the benefits of direct browser test execution and Jest-like APIs as well as the accepted `ignoreHTTPSErrors` limitation.
- [ ] Update testability and quality descriptions from jsdom browser integration to Vitest Browser Mode.
- [ ] Update the developer guide with Vitest Browser Mode setup, Chromium provisioning, and the certificate-validation limitation.

### Implementation

- [ ] Add Vitest, Vite, and Vitest's Playwright browser provider; configure a Chromium browser project.
- [ ] Add Node global setup and teardown for the Exasol container, and provide its endpoint and credentials as serializable browser-test data.
- [ ] Refactor the existing basic, pool, and compression shared suites to isolate browser-safe scenario assertions from Node-only Testcontainers imports, certificate loading, `process` access, and the certificate-aware factory; retain their SQL cases and coverage.
- [ ] Create thin Vitest browser wrappers for those suites. Import `@exasol/exasol-driver-ts/browser`, create the native `WebSocket` factory, consume the global-setup connection data, and replace `jest.setTimeout` with Vitest timeout configuration.
- [ ] Replace the jsdom integration project and its custom jsdom TLS environment with the Vitest browser project; preserve Node integration-test behavior.
- [ ] Provision Chromium in CI and update npm scripts.

### Verification

- [ ] Assert native browser WebSocket connections use `wss`; do not assert certificate rejection because Vitest accepts certificate errors by design.
- [ ] Run `npm run build`, `npm run typecheck`, `npm run lint:ci`, `env -u NODE_OPTIONS npm run itest`, and `npm run trace`.
