## Developer guide

This driver is based on the [Exasol WebSocket API](https://github.com/exasol/websocket-api).

### Requirements

- Node.js
- Docker

### Linting

```sh
npm run lint    # Will autofix issues
npm run lint:ci # No autofix enabled
```

### Security Audit

```sh
npm run audit
```

* Production dependencies may not have any audit findings.
* Findings in dev dependencies can be excluded via [audit-ci.jsonc](../../audit-ci.jsonc)

### OpenFastTrace

Run requirement tracing with:

```sh
npm run trace
# Generate tracing report at dist/trace-report.html
npm run trace:report
```

### Unit tests

```sh
npm run test
```

### Integration tests

```sh
npm run itest
```

By default, integration tests use the current default Exasol Docker DB image. To test
against a different database version, set `EXASOL_DOCKER_VERSION` to its Docker image:

```sh
EXASOL_DOCKER_VERSION=exasol/docker-db:2025.1.16 npm run itest
```

#### General

We run the same integration tests with both Node.js and the browser.

* `integration-test/package/`: Smoke tests for entry points
* `integration-test/testcases/runtime.ts`: Shared interfaces for both runtimes
* `integration-test/testcases/*.ts`: Common test cases for both environments
* `integration-test/node/`: Node.js specific tests cases
* `integration-test/browser/`: Browser specific test cases

#### Node.js Integration Tests With Jest

Node.js integration tests run with Jest: `npm run itest:node`.

#### Browser Integration Tests With Vitest

Browser integration tests run in Chromium through Vitest Browser Mode: `npm run itest:browser`

The test command installs the provider-managed Chromium binary automatically via script `preitest:browser`. GitHub Actions also installs the required Linux browser dependencies:

```sh
npm run itest:browser
```

Vitest Browser Mode accepts certificate errors in its Chromium contexts. The browser suite verifies the native browser WebSocket implementation and encrypted `wss` transport, but does not verify database certificate, CA-chain, or hostname validation.

### Browser-safe package verification

Build and verify the Node.js and browser package entry points with:

```sh
npm run test:package
```

The browser entry point is `@exasol/exasol-driver-ts/browser`. It intentionally excludes Node.js local file import/export and their filesystem, networking, and TLS modules; applications still provide an explicit WebSocket factory.

#### MacOS

If you're using Docker Desktop, please set

```sh
export DOCKER_HOST=unix:///Users/$(whoami)/Library/Containers/com.docker.docker/Data/docker.raw.sock
```

#### Linux With Lima

If you are using Lima on Linux, set

```sh
export DOCKER_HOST=unix:///home/$(whoami)/.lima/default/sock/docker.sock
```

### Upgrade Dependencies

```sh
npx npm-check-updates@latest --upgrade
```

### Testing your changes locally before publishing

You can use `npm install <directory of this project>` to install the driver locally in your other node test projects.
Don't forget to (re)build the driver using `npm run build` to see your changes reflected.
In case of unexplainable errors in your tests it might help to remove the entire `/dist` folder before rebuilding.

### Release Process

Currently we release this project by hand.

#### Steps

- Update release date in changelog file `doc/changes/change_<version>.md`
- Merge Pull Request to `main`
- Make a [new release](https://github.com/exasol/exasol-driver-ts/releases/new) on GitHub
  - Use content from the changelog file as release description
  - This will trigger the [release workflow](../../.github/workflows/release.yml) and publish to [npmjs.com](https://www.npmjs.com/package/@exasol/exasol-driver-ts)
