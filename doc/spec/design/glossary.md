# Glossary

This chapter defines design-specific terms used in the architecture documentation.

General project terms are defined in [System Requirements](../system_requirements.md).

## ExaWebsocket

The minimal WebSocket-compatible interface used by the driver.

## SQLResponse

The generic response envelope returned by Exasol protocol commands.

## QueryResult

The user-facing wrapper that exposes result-set columns and row objects.

## Import Tunnel

The Exasol-provided network channel used by Node.js CSV import to stream file content into the database.

## Chunked Response

The HTTP transfer format used by the CSV import implementation to send file data over the import tunnel.

## Open Issues

* None known.
