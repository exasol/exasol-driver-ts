# Architecture Constraints

This chapter documents technical and organizational constraints that shape the architecture.

## Technical Constraints

### TypeScript Library Package
`constr~typescript-library-package~1`

The system is implemented as a TypeScript npm package that publishes compiled artifacts from `dist/` and type declarations through `package.json`.

Rationale:

`package.json` defines `main`, `module`, `types`, build scripts, and the npm package name `@exasol/exasol-driver-ts`.

Needs: dsn

### Browser and Node.js Runtime Support
`constr~browser-and-nodejs-runtime-support~1`

The system must run in browser and Node.js runtimes for the core driver and pool features.

Rationale:

Application developers use the library in server-side Node.js services and browser-based applications. Supporting both runtimes lets them use one Exasol driver API across these application types.

Needs: dsn

### Injectable WebSocket Implementation
`constr~injectable-websocket-implementation~1`

The system must receive its WebSocket implementation from the application through a factory function.

Rationale:

Browser and Node.js runtimes provide different WebSocket implementations, and the public constructors accept a `websocketFactory`.

Needs: dsn

### Node-only CSV Import
`constr~node-only-csv-import~1`

CSV file import is limited to Node.js because it depends on local filesystem access and Node networking/TLS modules.

Rationale:

The implementation imports `node:fs`, `node:path`, `node:net`, and `node:tls`.

Needs: dsn

### Exasol WebSocket SQL Protocol
`constr~exasol-websocket-sql-protocol~1`

The system communicates with Exasol by sending JSON SQL protocol commands over WebSocket.

Rationale:

`Connection` serializes command objects to JSON and receives `SQLResponse` payloads.

Needs: dsn

## Organizational Constraints

### GitHub and npm Distribution
`constr~github-and-npm-distribution~1`

The system is developed on GitHub and released as an npm package.

Rationale:

The README links GitHub Actions and npm badges. The developer guide documents a manual release process that triggers a GitHub release workflow publishing to npm.

Needs: dsn

### Automated Quality Gates
`constr~automated-quality-gates~1`

Changes are expected to pass linting, tests, coverage collection, dependency audit, and SonarCloud analysis.

Rationale:

The package scripts, developer guide, and Sonar configuration define these checks.

Needs: dsn

## Assumptions

* Users provide a reachable Exasol database and valid credentials or tokens.
* Browser applications can reach the Exasol WebSocket endpoint from the browser environment.
* Node.js users install `ws` or another compatible WebSocket implementation when needed.

## Open Issues

* The minimum supported Node.js version is not documented.
* Supported browser versions are not documented.
