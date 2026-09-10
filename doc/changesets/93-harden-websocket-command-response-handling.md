# GH-93 Harden WebSocket command-response handling

## Goal

Make each database WebSocket connection reliably serialize command/response exchanges. A failed or malformed exchange must not leave queued work hanging or allow a broken connection to be reused from an `ExasolPool`.

## Scope

In scope:

* A permanent, per-connection WebSocket dispatcher and FIFO queue for all response-producing protocol commands.
* Immediate, response-less `abortQuery` cancellation.
* Terminal handling for transport failures and malformed or unsolicited response frames.
* Deterministic unit coverage and a Docker-backed pooled-connection recovery regression.

Out of scope:

* The acknowledgement-focused fix in GH-82.
* Borrow-time validation changes from GH-91.
* Public API, dependency, version, changelog, and user-guide changes.

## Design References

* [System Requirements](../spec/system_requirements.md)
* [Building Block View](../spec/design/building_block_view.md)
* [Runtime View](../spec/design/runtime_view.md)
* [Quality Requirements](../spec/design/quality_requirements.md)

## Strategy

Deliver three mergeable PRs in order. Each PR must retain the existing exported API and preserve the protocol distinction that `abortQuery` sends no response. Update OpenFastTrace requirements and design items before changing the implementation they describe.

## Task List

- [ ] Confirm the existing `kaklakariada/issue93` branch is the working branch.

### PR 1: Serialize Response-Producing Commands

#### Requirements And Design

- [ ] Revise the WebSocket connection design item to define permanent message dispatch and FIFO serialization of response-producing commands.
- [ ] Request review of the revised design before implementation.

#### Implementation

- [ ] Replace the per-command `onmessage` assignment in `Connection` with one dispatcher installed when the connection is created.
- [ ] Queue response-producing commands in FIFO order, send only the head command, settle it from its response, and then dispatch the next command.
- [ ] Remove the parallel-command rejection for queued response-producing commands.
- [ ] Keep `abortQuery` outside the queue so cancellation is transmitted immediately and does not consume a response.
- [ ] Keep `closeResultSet` on the response queue and preserve acknowledgement-before-connection-reuse behavior.

#### Verification

- [ ] Add deterministic connection unit tests for send order, response order, queued resolution, immediate cancellation, and `closeResultSet` acknowledgement ordering.
- [ ] Run the affected Node.js and browser unit-test projects.

### PR 2: Fail Queued Work Safely

#### Requirements And Design

- [ ] Revise `req~handle-unexpected-websocket-termination` and its scenario to cover all pending queued commands and malformed or unsolicited response frames.
- [ ] Revise the in-flight WebSocket-failure runtime design item to define a single terminal transition: mark broken/inactive, reject pending work, and clean up the socket.
- [ ] Request review of the revised requirements and runtime design before implementation.

#### Implementation

- [ ] Make the permanent socket error and close handlers reject the active and queued command promises with the available socket-failure details, mark the connection broken/inactive, and prevent reuse.
- [ ] Treat send failures, invalid payloads, invalid protocol response envelopes, and frames received without a queued command as terminal; reject pending work with the existing malformed-result error where applicable and close/clean up the socket.
- [ ] Route driver connection lifecycle callbacks through `Connection` without overwriting its permanent event handlers.

#### Verification

- [ ] Add deterministic connection unit tests for socket error, socket close, send failure, malformed payloads, invalid response envelopes, and unsolicited frames; assert every pending promise settles and the connection is broken.
- [ ] Update implementation and unit-test OpenFastTrace tags for the revised design items.

### PR 3: Verify Pooled Recovery End To End

#### Implementation And Verification

- [ ] Extend the Docker-backed connection-lifecycle integration coverage: break a borrowed pooled connection during work, assert rejection, then assert a later query uses a replacement driver and succeeds.
- [ ] Update integration-test OpenFastTrace tags for the revised failure design item.
- [ ] Run `env -u NODE_OPTIONS npm run itest` in a PTY with Docker access.

### Final Verification

- [ ] Run `npm run trace` and resolve all trace failures.
- [ ] Run `npm run lint:ci`, `npm run typecheck`, and `npm run test`.
- [ ] Run `npm run build`, `npm run test:package`, and `npm run audit`.
