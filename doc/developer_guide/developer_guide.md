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

### Package entry points

`npm run build` creates the Node.js package entry point and the browser-safe `@exasol/exasol-driver-ts/browser` subpath. The browser entry must not import Node.js CSV, filesystem, networking, or TLS modules.

The package declares `"type": "module"`. Rollup therefore writes ES module files with the `.js` extension and CommonJS files with the `.cjs` extension. Keep the conditional exports in `package.json` aligned with these filenames: `import` must resolve to the `.js` files and `require` must resolve to the `.cjs` files. Do not rename the CommonJS outputs to `.js`, because Node.js would interpret them as ES modules.

Both entry points require a WebSocket factory as the first constructor argument. Applications can use explicit factories for custom TLS, proxy, and transport settings.

### Integration tests

```sh
npm run itest
```

By default, integration tests use the current default Exasol Docker DB image. To test
against a different database version, set `EXASOL_DOCKER_VERSION` to its Docker image:

```sh
EXASOL_DOCKER_VERSION=exasol/docker-db:2025.1.16 npm run itest
```

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
