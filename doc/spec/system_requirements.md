# System Requirements

## Introduction

`@exasol/exasol-driver-ts` is a TypeScript and JavaScript driver for connecting applications to an Exasol database. Applications use the driver to open WebSocket connections, authenticate, execute SQL statements, fetch query results, manage a connection pool, and import local CSV files from Node.js.

The library is published as an npm package and is intended for both browser and Node.js runtimes. Browser applications use the runtime-provided `WebSocket` implementation. Node.js applications provide a compatible WebSocket implementation, for example the `ws` package.

## Goals

* Provide a typed Exasol SQL driver for TypeScript and JavaScript applications.
* Support both browser and Node.js runtimes through an injectable WebSocket factory.
* Expose simple APIs for connecting, querying, executing commands, and closing connections.
* Support secure database communication by default.
* Provide connection pooling for concurrent workloads.
* Support Node.js CSV file imports into Exasol tables.

## Evidence Base

This specification was reverse-engineered from:

* [User Guide](../user_guide/user_guide.md)
* [README](../../README.md)
* [Developer Guide](../developer_guide/developer_guide.md)
* Public API declarations in `src/index.ts`, `src/lib/sql-client.interface.ts`, `src/lib/sql-client.ts`, and `src/lib/sql-pool.ts`
* CSV import implementation in `src/lib/import/`
* Unit tests in `src/lib/**/*.spec.ts`, `src/lib/**/*.spec.node.ts`, and `src/lib/**/*.spec.dom.ts`
* Integration tests in `integration-test/`

## Notation

This document uses OpenFastTrace specification items to express product features, user requirements, and acceptance scenarios. Each specification item has a unique identifier in the form `<artifact-type>~<name>~<revision>`.

In this document, feature items use the artifact type `feat`, user requirements use `req`, and acceptance scenarios use `scn`. Design items under `doc/spec/design/` cover the scenarios with artifact type `dsn`. Architecture constraints in `doc/spec/design/constraints.md` use artifact type `constr` and are also covered by `dsn` items.

## Terms and Abbreviations

### Driver

The `ExasolDriver` API that manages one logical Exasol database connection and exposes SQL execution operations.

### Pool

The `ExasolPool` API that manages multiple `ExasolDriver` instances through configurable minimum and maximum pool sizes.

### Query

A SQL statement that returns a result set. The driver exposes query results through `QueryResult`.

### Command

A SQL statement that changes database state or returns a row count. The driver exposes command execution through `execute()`.

### Raw Response

The Exasol protocol response returned without converting it to `QueryResult` or row count.

### WebSocket Factory

A user-provided function that receives the database WebSocket URL and returns an object compatible with the driver's `ExaWebsocket` interface.

### CSV Import

Node.js-only functionality that imports a readable local CSV file into an Exasol table using Exasol's `IMPORT FROM CSV` mechanism.

## User Roles

### Application Developer

A developer who installs the npm package and uses the public TypeScript or JavaScript API in an application.

### Browser Application

A web application that uses the package with the browser's native `WebSocket`.

### Node.js Application

A server-side or local Node.js application that uses the package with a Node-compatible WebSocket implementation and can use Node-only CSV import.

### Database Operator

A person or automation responsible for providing database host, port, credentials, schema, TLS, and connectivity settings.

## Features

This chapter describes product features at a level suitable for product communication. Detailed user needs and constraints are refined in the requirement items that cover these features.

### `<Feature Title>`
`feat~<feature-id>~1`

`<User-visible capability and why it matters.>`

Status: draft

Needs: req

## User Requirements

The following requirements refine the product features into user-visible behavior, constraints, and quality expectations.

### `<Requirement Title>`
`req~<requirement-id>~1`

`<Requirement stated from the user's perspective. Avoid implementation structure unless it is visible or contractually relevant.>`

Rationale:

`<Intent inferred from the user guide or other user-facing evidence.>`

Status: draft

Covers:
- `feat~<feature-id>~1`

Needs: scn

## Acceptance Scenarios

The following scenarios describe observable behavior in Given-When-Then form.

### `<Scenario Title>`
`scn~<scenario-id>~1`

**Given** `<initial state or precondition>`
**When** `<user action or external event>`
**Then** `<observable result>`

Status: draft

Covers:
- `req~<requirement-id>~1`

Needs: dsn

## Open Issues

Record unresolved questions, contradictions, and weakly supported inferences. Do not remove an issue until the user has resolved it or a stronger source has been found.

### `<Short Issue Title>`

Source evidence:

* `<source and location>`
* `<conflicting source and location>`

Issue:

`<Describe the contradiction, missing intent, or uncertainty.>`

Decision needed:

`<Question for the user or future maintainer.>`
