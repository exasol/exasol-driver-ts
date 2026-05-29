# Open Issues

This chapter collects unresolved contradictions, missing intent, and weakly supported design conclusions found during reverse engineering.

## Requirements and Design Mismatches

* None known for the documented public API.

## Implemented Behavior Without Requirement

* Low-level metadata commands such as `getSchemas`, `getTables`, `getUsers`, `getRoles`, `getFunctions`, `getScripts`, and `getColumns` exist as command classes but are not documented in the user guide.

## Requirement Without Observed Implementation

* Browser and Node.js support are documented and tested, but exact supported runtime versions are not documented.

## Contradictions Between Sources

* CSV import is a package feature, but it is Node.js-only while the package is also advertised for browser usage.

## Decisions Needed

* Decide whether to document or hide low-level command classes as public API.
* Decide whether to split browser-safe and Node-only exports.
* Decide the minimum supported Node.js and browser versions.
