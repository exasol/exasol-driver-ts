## Developer guide

### Requirements

- NodeJS
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

### Unit tests

```sh
npm run test # Runs both test in parallel
npm run test:dom
npm run test:node
```

### Integration tests

```sh
npm run itest # Runs both test in parallel
npm run itest:dom
npm run itest:node
```

#### MacOS

If you're using Docker Desktop, please set

```sh
export DOCKER_HOST=unix:///Users/$(whoami)/Library/Containers/com.docker.docker/Data/docker.raw.sock
```

### Testing your changes locally before publishing

You can use `npm install <directory of this project>` to install the driver locally in your other node test projects.
Don't forget to (re)build the driver using `npm run build` to see your changes reflected.
In case of unexplainable errors in your tests it might help to remove the entire `/dist` folder before rebuilding.

### Release Process

Currently we release this project by hand.

#### Steps

- Write a changelog file
- Add a link to `doc/changes/changelog.md`
- Update the version in `package.json`
- Merge Pull Request to `main`
- Make a [new release](https://github.com/exasol/exasol-driver-ts/releases/new) on GitHub
  - This will trigger the [release workflow](../../.github/workflows/release.yml) and publish to [npmjs.com](https://www.npmjs.com/package/@exasol/extension-manager-interface)
