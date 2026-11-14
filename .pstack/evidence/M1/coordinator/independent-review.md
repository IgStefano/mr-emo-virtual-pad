# M1 independent review: ISSUES

Snapshot verified with `git rev-parse HEAD`: 42fed3ac13a90d6c025c3a7bb803e7f3c2d81f63. Original M1 head supplied in brief: 589d4597bc32875528de0f0933015cfa1d393d6b, original base e7d10898e94b857470ab34b5241cb9e18723932f. No checkout changes, production changes, test changes, publication, or delegation.

## Reproduction

Linux, Node v24.21.0. `NODE_PATH=/home/igstefano/.t3/projects/mr-emo-virtual-pad/node_modules node reports/m1-review/run.cjs` transpiles the exact checkout modules with the existing shared TypeScript dependency into this ignored scratch directory and invokes public handle methods against a real temporary ten-byte file. See repro.ts and repro.log. Temporary data is deleted in finally. No alternate checkout's production code executes.

1. P2, src/main/storage/media-protocol.ts:75-114. HEAD must ignore Range. Expected HEAD with bytes=1-3 and bytes=20- both 200, Content-Length 10, no Content-Range, empty body. Observed respectively 206/length 3/bytes 1-3/10 and 416/bytes */10. Existing test at tests/media/protocol.test.ts:381 explicitly locks in the former defect. This can mislead metadata consumers; no actual Electron playback failure claimed. RFC 9110 section 14.2 requires ignoring Range on methods other than GET.

2. P2, src/main/storage/media-protocol.ts:77-82. GET with unknown range unit items=0-2 must ignore Range and serve the complete representation (200, ten bytes). Observed 416. GET with Bytes=1-3 must recognize the case-insensitive unit and serve 206, body 123. Observed 416. The same strict regex causes both interoperability defects. RFC 9110 sections 14.1 and 14.2 specify case-insensitive range units and mandatory ignoring of unknown units. Invalid byte syntax and unsupported multi-range policy are separate and are not findings here.

3. P2 conditional Windows containment defect, src/main/storage/application-protocol.ts:37-40. Executable Node path.win32 evidence: relative('C:\\app\\renderer','D:\\private\\secret.txt') returns D:\\private\\secret.txt; startsWith('..'+win32.sep) is false. Expected an external resolved path to be rejected. A bundled file symlink to a file on another volume, or a directory junction to that volume followed by a child filename, can produce this resolved path. The protocol then opens the already resolved regular file, so O_NOFOLLOW cannot repair this predicate. Requires an escaping link in the bundle; an ordinary URL alone does not create that link. Full Windows handle reproduction was unavailable. This is observed predicate evidence and a platform runtime inference, not an observed Windows disclosure. Reject absolute relative results as well as parent paths.

Primary sources:
- https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2
- https://www.rfc-editor.org/rfc/rfc9110.html#section-14.1
- https://nodejs.org/docs/latest-v24.x/api/fs.html#file-open-constants
- https://raw.githubusercontent.com/nodejs/node/v24.15.0/src/node_constants.cc
- https://raw.githubusercontent.com/nodejs/node/v24.15.0/deps/uv/src/win/fs.c

## Lifecycle and portability assessment

Source inspection shows pending requests enter the per-request registry before authorization; authorization precedes open; abort checks follow authorization, open, and stat. Revoke targets matching entries; dispose permanently denies new requests. Cleanup removes the entry/listener and closes actual descriptors. Body errors propagate, ranges clamp to file size, reads allocate at most 65536 bytes, and zero reads fail rather than looping. Existing tests exercise delayed authorization/open/stat and delayed read revocation, real descriptor closure and lease isolation. No additional runtime defect proven in these paths.

O_NOFOLLOW is not portable to Windows. Official Node documentation explicitly lists supported Windows open constants and excludes it. Node exports it only under #ifdef O_NOFOLLOW; Windows libuv open code has no NOFOLLOW handling. Therefore a missing constant bitwise-OR coerces to zero rather than offering protection. This is primary-source portability evidence, not a Windows execution. It does not imply ordinary Windows regular files fail to open. A media escape would require a replaced managed asset or ancestor. ManagedFiles validates directory shape at creation; hostile replacement hardening is A2, so this review does not invent a renderer capability to replace the filesystem. Windows symlink rejection needs a target runner before being claimed verified.

## Tests and mutation evidence

`node /home/igstefano/.t3/projects/mr-emo-virtual-pad/node_modules/vitest/vitest.mjs run tests/media/protocol.test.ts --config reports/m1-review/vitest.config.mjs`: 71 passed. Scratch config points Vitest and Zod at existing shared dependencies. See protocol-tests.log. Initial all-media attempt passed these 71 but failed metadata suite setup because music-metadata was unavailable in this checkout; see focused.log. Coordinator's supplied 78-pass result is not claimed as independently reproduced.

Committed mutation-summary.json totals 746 Killed and 1 Timeout, with the timeout in media-protocol. It contains neither mutant identity/replacement nor covered-test IDs or diagnostics. M1's referenced verify-third.log and detailed mutation.json are absent here. The shared project's existing detailed report does not include either protocol module and cannot explain this timeout. Tests awaiting an explicit close/reached promise can legitimately hang when a mutant removes the effect that resolves it. That mechanism is plausible but does not identify the actual timeout. Thus no evidence of an unresolved baseline hang was found (71 tests finish in about one second), but the particular timeout cannot be classified as a real mutant hang from available artifacts. Preserve this evidence gap; do not call all mutants killed or change the gate by preference. Retrieve the original detailed report or rerun the identified mutant to close it.

I1 playback, packaged compatibility, and physical Mac/audio remain pending outside this module review. Type System Discipline informed checking schema parsing before authority and filesystem boundaries, without demanding private structure or production changes.
