# J1 independent review. ISSUES.

Review the finite bridge and catalog service for the drummer's offline pad before coordinator acceptance.

Target `/home/igstefano/.t3/worktrees/mr-emo-virtual-pad/t3-e461dfe7-763090d48d58cf4f`.
HEAD `605425b6dccbcb358831c6e417d53367e34af34b`.
Base `e7d10898e94b857470ab34b5241cb9e18723932f`.
Verified exact HEAD and empty tracked status before reading/reproducing and after execution. No target source, tests, configuration, package installation or branches changed. All review artifacts are in this ignored directory. No agents spawned.

## Findings

1. P1. Exclusive read tracking rejects valid media requests and prevents release from starting.

Source `src/main/ipc/catalog-session.ts` lines 30–36, 47–49, 62–70 and 109.
`authorizeMedia` obtains its snapshot through the exclusive `track` gate. Two valid authorizations issued together for the same existing asset and active playback lease return one success and one `busy`. A read followed immediately by a valid bridge release yields `busy`, with zero media cleanup calls. This reproduces with the actual ManagedCatalog and SQLite, despite its synchronous underlying database read. Promise scheduling alone holds the exclusive gate long enough. It does not require a slow database or hypothetical async adapter.

Expected both independent authorizations to succeed for an existing asset under the same current playback lease. Expected STOP's acknowledged release to wait for necessary work and run cleanup rather than fail because of a read. Finite errors and frozen seams do not establish a renderer retry obligation for otherwise valid media requests. This can reject overlapping media/range authorization and make STOP surface failure under a catalog refresh. M1's mapping of this rejection to HTTP 403 was not executed because that implementation is absent from this target.

Observed probe labels `REAL_SQLITE_CONCURRENT_AUTH` and `REAL_SQLITE_READ_RELEASE` in probe.log. The imported file and SQLite are temporary. The metadata validator is an injected acceptance port returning a valid duration. This verifies copy/catalog/session behavior, not native audio decode.

2. P1. Media authorization does not revalidate the playback lease after awaiting its catalog read.

Source `src/main/ipc/catalog-session.ts` lines 101–112, especially 110.
Once `track` removes the read from its pending set, a release can proceed before `authorizeMedia` resumes. The latter only rechecks session identity. The controlled async read probe uses a catalog snapshot copied from the successful real import, resolves its read, and attempts release through the public service until the exclusive gate opens. Release succeeds and invokes cleanup. When authorization evaluates membership, public `SessionAuthority.assert(lease)` already rejects that lease, yet authorization returns success. The assets getter records this public assertion at the exact membership decision; it does not alter the snapshot or service fields.

Observed `ASYNC_LEASE_RECHECK` contains `heldAtMembership:false`, `authorization:{ok:true}`, and successful release/one cleanup. Expected unauthorized when the lease no longer exists. This violates the M1 authorization seam's requirement to reject expired leases and can authorize opening media after cleanup has revoked its resources. This reproduction uses a controlled asynchronous catalog port permitted by CatalogOperations. The stale-lease timing was not independently reproduced with the unwrapped SQLite implementation, and should not be represented as such.

## Other reviewed behavior

Read AGENTS.md, local Codex/T3 adapter and upstream poteto-mode reference. User's explicit no-spawn/read-only scope overrides upstream delegation/edit workflows. Throughput checkpoint is n/a for this read-only investigation.

Read the frozen integration seams, J1 evidence README, all requested source and both requested test files, plus ManagedCatalog, operations DTOs and product specification.

Registration checks exact sender object, frame object and current URL before request parsing/service invocation. Bridge requests and responses use Zod; registration also validates responses and emits finite error codes. No generic invoke capability or recovery/termination method is exposed to the renderer. Existing tests exercise forged identities, malformed DTOs, wrong session/lease IDs, output validation and finite channels. No additional proven boundary bypass was found.

Service holds edit authority across dialog and async catalog work. Pending operations block normal release/dispose. Existing executed tests prove dialog-held import and renderer termination draining, cleanup failure retaining authority, successful retry, stale-session rejection and closing-state rejection of media completion. ManagedCatalog additionally asserts authority after asynchronous copy/metadata work before promotion. No additional proven defect in those paths was found.

Opening assigns service.session only after recovery, while the session ID is generated inside authority.open. The controlled pending-recovery probe confirms that termination with a previous ID is unauthorized and that a completed open without disposal blocks replacement with busy. This is not reported as a separate defect: bootstrap can capture the main-side registration response independently of renderer receipt, await pending open, and then terminate with that ID. The current registration seam provides no dedicated termination identity observer. I1 must demonstrate this capture/drain path rather than rely on the dead renderer supplying its ID. This review does not prove bootstrap has implemented it.

## Commands and execution

Run from this reviewer's checkout.

```
node reports/j1-review/probe.cjs > reports/j1-review/probe.log 2>&1
node /home/igstefano/.t3/worktrees/mr-emo-virtual-pad/t3-e461dfe7-763090d48d58cf4f/node_modules/vitest/vitest.mjs run --root /home/igstefano/.t3/worktrees/mr-emo-virtual-pad/t3-e461dfe7-763090d48d58cf4f --cache=false tests/ipc/catalog-session.test.ts tests/contracts/desktop.test.ts > reports/j1-review/tests.log 2>&1
```

Probe exits 0 and prints the reproduced behavioral failures. Both existing test files pass, 9 tests total. See tests.log. The probe loads target TypeScript with the target's installed TypeScript transpiler through an in-memory CommonJS hook. It writes no emitted files into the target and cleans its temp database/files.

Author-reported 82 tests and 644 killed mutants were not rerun or adopted as reviewer execution. No playback/platform, Mac/interface, packaged-runtime or device readiness claim. Native playback remains I1; physical acceptance stays deferred. Recommendation is to fix the two proven service defects and independently rerun the probes before accepting J1.
