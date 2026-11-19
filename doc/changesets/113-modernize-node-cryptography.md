# GH-113 Modernize Node cryptography and enforce bundle budgets

## Goal

Keep the existing driver API and Exasol protocol while reducing runtime dependencies and bounding complete consumer bundle sizes.

## Scope

In scope:

* Separate Node and browser password encryption behind an internal runtime boundary.
* Generate the Node local-transfer certificate with Node cryptography and retain its SPKI pin format.
* Enforce raw and gzip size budgets for complete Node and browser bundles during build.
* Document runtime selection and verify Node, browser, and package behavior.

Out of scope:

* Public API or wire protocol changes.

## Design References

* [System Requirements](../spec/system_requirements.md)
* [Runtime View](../spec/design/runtime_view.md)
* [Quality Requirements](../spec/design/quality_requirements.md)
* [Solution Strategy](../spec/design/solution_strategy.md)

## Strategy

Node's `crypto` API generates keys and signs data but does not expose a certificate builder. The Node-only transfer module therefore encodes the fixed, minimal X.509 certificate structure needed for this temporary TLS identity; Node crypto performs RSA generation and SHA-256 signing.

## Task List

- [x] Update traced design and user documentation for runtime behavior and packaging.
- [x] Split password encryption; use native Node RSAES-PKCS1-v1_5 and browser-safe RSA.
- [x] Replace Node transfer certificate generation with native crypto while preserving PEM and SPKI pinning.
- [x] Add complete-bundle size budgets to `npm run build`.
- [x] Add payload and TLS handshake tests; retain shared real-browser login tests and extend package isolation checks.
- [x] Run lint, typecheck, unit, package, Docker Node and Chromium integration, audit, and trace gates.

Verification passed against the cached Exasol 2026.1.1 Docker image: 302 unit tests, 56 Node integration tests, and 21 headless Chromium integration tests. Playwright is an explicit development dependency of the browser test provider. The production audit has zero findings; the full audit passes with the existing advisory-specific development exceptions.
