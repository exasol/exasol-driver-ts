# Quality Requirements

This chapter documents architecture-relevant quality requirements and technical quality goals.

User-facing acceptance scenarios are defined in [System Requirements](../system_requirements.md).

## Requirement Quality

Use this OFT hierarchy:

1. `feat`: top-level feature
2. `req`: user requirement
3. `scn`: Given-When-Then acceptance scenario
4. `constr`: architecture constraint
5. `dsn`: design requirement covering scenarios and constraints
6. `impl`: implementation
7. `utest`: unit test
8. `itest`: integration test

Runtime design requirements `dsn` should cover one scenario or constraint at a time when practical. Grouping is acceptable for facade-level or component-level descriptions that would otherwise duplicate the same design text.

## Code Quality

The codebase is TypeScript-first and uses ESLint with the recommended JavaScript and TypeScript rules plus Prettier compatibility. Source files use ES modules. Generated distribution files under `dist/` are excluded from linting.

Public APIs should remain typed and exported from `src/index.ts` when they are part of the package contract.

## Test Quality

Jest is the test framework. Unit tests are split into Node.js and jsdom projects:

* `unit-node` runs `src/**/*.spec.ts` and `src/**/*.spec.node.ts` in Node.js.
* `unit-dom` runs `src/**/*.spec.ts` and `src/**/*.spec.dom.ts` in jsdom.
* `itest-node` runs Node.js integration tests under `integration-test/node/`.
* `itest-dom` runs browser-style integration tests under `integration-test/browser/`.

Tests should cover protocol command handling, driver behavior, pool behavior, CSV import helpers, error reporting, and integration behavior against Exasol where practical.

## Dependency Policy

Runtime dependencies are listed in `package.json` and documented in `dependencies.md` with license information. The current runtime dependencies are `generic-pool`, `node-forge`, and `pako`.

Dependency changes must keep `package-lock.json` consistent. Production dependencies must not have npm audit findings. Development dependency findings may be handled through `audit-ci.jsonc` when justified.

## Static Analysis and Security Gates

The repository defines the following verification commands:

* `npm run lint:ci` for non-mutating lint checks.
* `npm run typecheck` for TypeScript checking without emit.
* `npm run trace` for OpenFastTrace requirement tracing.
* `npm run test` for Node.js and jsdom unit tests with coverage.
* `npm run itest` for Node.js and browser integration tests with coverage.
* `npm run audit` for production and full audit checks.
* `npm run build` for Rollup packaging.

SonarCloud consumes `coverage/lcov.info`, analyzes `src/`, excludes generated JavaScript and spec files from source analysis, and treats tests from `src/` and `integration-test/` as test input. The Sonar quality gate enforces minimum coverage for new code; new code must have at least 80% test coverage.

### Verification Gate Definition
`dsn~verification-gate-definition~1`

The system defines quality gates through npm scripts, Jest project configuration, ESLint configuration, npm audit configuration, and SonarCloud project settings.

Covers:
- `constr~automated-quality-gates~1`

## Testability and Coverage

The design favors testability by separating protocol command construction, connection handling, result fetching, pooling, CSV SQL generation, HTTP tunnel handling, TLS wrapping, and file import behavior into focused modules.

Coverage is collected by Jest into `coverage/`. Minimum coverage is enforced by SonarCloud on new code, which must have at least 80% coverage.

## Open Issues

* Some formatting is enforced manually through Prettier rather than checked by a dedicated `format:check` script.
