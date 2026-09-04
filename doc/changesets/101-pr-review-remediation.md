# PR-101 Review Remediation Plan

## Goal

Resolve the high- and medium-severity review findings for local Parquet import without coupling the fixes. Each task below is independently implementable, testable, and releasable. Apply the tasks in priority order; no task relies on another task's code change.

## 1. Correct suffix byte-range responses

**Status:** Fixed

**Finding:** `Range: bytes=-N` treats `N` as both a suffix length and an absolute end offset. Parquet readers commonly use this form to read the footer, so valid imports can receive `416 Range Not Satisfiable`.

**Implementation steps:**

1. Update `parseByteRange()` in `src/lib/import/http-protocol.ts` to distinguish the three valid range forms before calculating offsets.
2. For a suffix range, calculate `start` as `max(0, fileSize - suffixLength)` and always set `end` to `fileSize - 1`.
3. Retain the existing behavior for explicit (`start-end`) and open-ended (`start-`) ranges, including clamping an explicit end to the file size and returning `null` for unsatisfiable ranges.
4. Keep the response path unchanged: a valid range produces `206`, `Content-Range`, and exactly the requested file bytes.

**Unit tests:**

1. Through `serveFileRequests()` with a six-byte fixture, send `GET` with `Range: bytes=-3`; assert `206`, `Content-Range: bytes 3-5/6`, `Content-Length: 3`, and body `def`.
2. Send `Range: bytes=-6` and a suffix length larger than the file; assert the complete file is returned with `Content-Range: bytes 0-5/6`.
3. Preserve coverage for explicit, open-ended, malformed, and unsatisfiable ranges. Add them if they are not already covered by the same unit-test block.

## 2. Serve zero-byte files safely

**Status:** Fixed

**Finding:** A GET without a Range header for a zero-byte file derives `{ start: 0, end: -1 }` and passes it to `fs.createReadStream()`, which throws `RangeError`.

**Implementation steps:**

1. In the range-serving branch of `sendFileResponse()`, handle an absent Range header and `fileSize === 0` as a header-only `200 OK` response with `Accept-Ranges: bytes` and `Content-Length: 0`.
2. Do not create a read stream for that response.
3. Retain `416` with `Content-Range: bytes */0` for all byte-range requests against an empty file.

**Unit tests:**

1. Serve an empty temporary file for a no-range GET; assert that the promise stays usable, writes `200 OK` and `Content-Length: 0`, and does not invoke `onFileStream`.
2. Serve the same file for `Range: bytes=0-0`; assert `416` and no read stream.

## 3. Make SQL failure authoritative across the tunnel lifecycle

**Status:** Fixed

**Findings:** `serveFileRequests()` races SQL completion only while waiting for the next request. If Exasol rejects the import during a backpressured file response, the stream can wait forever for `drain` instead of exposing the SQL failure. Separately, before the first request, `E-EDJS-13` from a closing tunnel can win the race against the same SQL rejection and replace the useful database message with a generic socket-closed error.

**Implementation steps:**

1. Race each in-flight `sendFileResponse()` operation against the existing SQL-result promise, not only `readHttpRequest()`.
2. When SQL resolves, finish `serveFileRequests()` with its row count rather than starting another request cycle. When SQL rejects, reject with that original error.
3. On either SQL outcome winning the response race, destroy the active file stream and remove all response/socket listeners before returning or throwing.
4. Treat the normal request-header-close error `E-EDJS-13` consistently whether zero, one, or many requests have been served: await `sqlPromise` so its result or rejection becomes the caller-visible outcome. Remove `servedRequest` if it has no remaining purpose.
5. Keep all non-`E-EDJS-13` request-reading and socket errors immediately observable.

**Unit tests:**

1. Start a range GET with a `FakeSocket` whose `write()` returns `false`, so the file stream pauses awaiting `drain`; reject the SQL promise and assert that `serveFileRequests()` rejects with that SQL error and the file stream is destroyed.
2. In the equivalent backpressured setup, resolve the SQL promise; assert that the row count is returned and the file stream is destroyed.
3. Start `serveFileRequests()` with no request, emit `end`, then reject the SQL promise; assert the SQL error is returned. Repeat with a resolved SQL promise and assert the row count is returned.
4. Emit a non-`E-EDJS-13` read error while SQL is pending; assert that it is still reported immediately rather than being replaced by SQL completion.
5. Keep the existing tunnel-close/backpressure test to ensure a socket failure still rejects and cleans up when SQL remains pending.

## 4. Make CSV chunked responses fail on tunnel errors and closure

**Status:** Fixed

**Finding:** `sendChunkedResponse()` listens only to the source stream. A closed or errored tunnel can leave a paused CSV source waiting for `drain`, or cause an unhandled socket error.

**Implementation steps:**

1. Give `sendChunkedResponse()` the same response-lifecycle guarantees as `writeReadable()`: listen for socket `error` and `close`, remove the `drain` listener during cleanup, and destroy the source stream when failing.
2. Convert socket failures into the established `E-EDJS-18` chunked-response error, preserving the underlying reason in its message.
3. Protect header, chunk, and terminal writes from synchronous `socket.write()` errors and route them through the same failure path.
4. Do not change CSV HTTP framing or successful backpressure behavior.

**Unit tests:**

1. Use a backpressured fake socket and a readable source; emit `close` after the source pauses and assert rejection with `E-EDJS-18` plus source destruction.
2. Emit `error` from the socket during an active chunked response; assert a handled `E-EDJS-18` rejection rather than an unhandled event.
3. Make `write()` throw for the header and for a data chunk in separate tests; assert the same error mapping and cleanup.
4. Retain the successful multi-chunk and terminating-zero-chunk tests.

## 5. Execute the unsupported-version integration scenario in CI

**Status:** Outstanding

**Finding:** The unsupported-Parquet integration suite requires encrypted import/export support but no Parquet support. None of the current CI images satisfies both conditions, so the suite is permanently skipped.

**Implementation steps:**

1. Add `2025.1.8` to the Exasol-version matrix in `.github/workflows/ci-build.yml`; it supports encrypted tunnels but predates Parquet import support (`2025.1.9`).
2. Leave the existing capability predicates as the single source of test selection: CSV tests run on the added image, successful Parquet tests skip, and the unsupported-Parquet scenario runs.
3. Keep the assertion focused on the database's `ETL-2238: Remote File ...` response, thereby validating task 3 against a real unsupported server.

**Tests:**

1. Run the integration suite with `EXASOL_DOCKER_VERSION=2025.1.8`; verify that the unsupported-Parquet test executes rather than being skipped and receives `E-EDJS-25` with `ETL-2238`.
2. Run the normal CI matrix and verify the supported-version Parquet import remains green while Exasol 8 continues to skip encrypted-import tests.

## Verification

Run focused `http-protocol.spec.node.ts` tests after tasks 1–4, then run `npm run lint:ci`, `npm run typecheck`, `npm run test`, `npm run trace`, and `env -u NODE_OPTIONS npm run itest`. For task 5, include the explicit `2025.1.8` integration run before relying on the matrix.
