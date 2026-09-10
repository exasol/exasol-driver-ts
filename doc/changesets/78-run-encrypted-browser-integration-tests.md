# GH-78 Run encrypted browser integration tests in a real browser

## Goal

Verify the browser entry point against Exasol through Chromium's native WebSocket implementation over encrypted `wss` connections.

## Scope

In scope:

* Vitest Browser Mode integration tests for the existing basic, pool, and compression scenarios.
* Dedicated browser test files that import the browser entry point and use Vitest's Jest-like `test` and `expect` assertions in Chromium, with Playwright used only as Vitest's Chromium provider.
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
* [Quality Requirements](../spec/design/quality_requirements.md)

## Strategy

Use Vitest Browser Mode with its Playwright provider to import dedicated browser test files through Vite and execute their `test` and `expect` calls in Chromium. Keep test scenarios and assertions in those files rather than serializing code through a Node browser harness. Use Node global setup to manage the Exasol container and provide its connection settings to the browser tests. Accept Vitest's forced `ignoreHTTPSErrors: true`: the suite verifies native-browser WebSocket behavior and encrypted transport, but does not authenticate the database certificate.

## Task List

### Requirements And Design

- [ ] Revise the browser-native-WebSocket scenario and runtime design to specify Chromium-backed Vitest verification and its accepted certificate-validation limitation.
- [ ] Update testability and quality descriptions from jsdom browser integration to Vitest Browser Mode.
- [ ] Update the developer guide with Vitest Browser Mode setup, Chromium provisioning, and the certificate-validation limitation.

### Implementation

- [ ] Add Vitest, Vite, and Vitest's Playwright browser provider; configure a Chromium browser project.
- [ ] Add Node global setup and teardown for the Exasol container, and provide its endpoint and credentials to browser tests.
- [ ] Create dedicated browser test files for basic, pool, and compression coverage; import `@exasol/exasol-driver-ts/browser` directly and use Vitest `test` and `expect` assertions.
- [ ] Replace the jsdom integration project, custom Playwright harness, and browser test app with the Vitest browser project.
- [ ] Provision Chromium in CI and update npm scripts.

### Verification

- [ ] Assert native browser WebSocket connections use `wss`; do not assert certificate rejection because Vitest accepts certificate errors by design.
- [ ] Run `npm run build`, `npm run typecheck`, `npm run lint:ci`, `env -u NODE_OPTIONS npm run itest`, and `npm run trace`.
