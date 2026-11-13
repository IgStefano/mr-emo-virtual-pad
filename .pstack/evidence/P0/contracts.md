# P0 contract freeze

Base SHA: `715512da99a1abc069e6bfaf2d7874e0053a088d`.

This is the first operation contract version. Existing `DesktopApi.getAppInfo`
remains unchanged. Integrator must expose named operations after implementing
input/output validation and exact sender/frame/URL authorization. No runtime
operation is wired by P0.

## Exported surface

- `catalog.ts` exports branded UUID schemas/types for asset, pad, session and lease
  IDs, a repertoire UUID schema, a positive integral attempt schema/type, a
  nonnegative integral revision schema, `PadColor`, and strict asset, pad,
  repertoire and catalog schemas with inferred record types. Version 1 is the only
  accepted catalog version. Arrays have no repertoire size cap.
- `operations.ts` exports `ErrorCode`, its strict error envelope schema/type,
  `LeaseKind`, the strict session/lease/kind/attempt schema and `Lease`, edit,
  update, reorder, delete and playback request schemas. `LeaseAuthority` and
  `CatalogOperations` define the finite asynchronous operations. Import opens a
  main-owned selection dialog under an already reserved edit lease. It accepts no
  renderer file paths. A cancelled import returns the unchanged catalog.
- `AudioExecutor` owns one eligible audio element, starts only at offset zero,
  stops an identified attempt, subscribes via explicit `Unsubscribe`, and disposes.
  `AudioEventKind` and `AudioEvent` identify correlated execution/progress events.
  The executor resolves authorized asset IDs through its injected adapter.
- `domain/lease.ts` exports `LeasePhase`, `Reservation`, `LeaseState`, `LeaseAction`
  and `transitionLease`. This is a pure global reservation gate, independent of
  transport and catalog types. Callers supply unique session and lease IDs.

## Required adapter semantics

The integrator binds a session ID to the authorized sender, never trusts a
renderer-supplied session as authentication, and checks the full lease tuple
against main's active reservation. Attempts are caller-supplied monotonically
unique IDs within a session, including edit/recovery acquisitions. Lease IDs must
never be reused. Validation alone does not establish authority.

Acquire reserves synchronously before awaiting I/O. Main arbitrates playback,
edit and recovery through the same reservation gate. Only the matching owner can
begin cleanup. A cleanup acknowledgement while held is ignored. Once cleaning,
no second acquisition succeeds until matching acknowledgement. Failed cleanup or
release retains the reservation for retry. Session disposal begins cleanup and
must await it, including delayed grants, before releasing main's reservation.

`AudioExecutor.stop` resolves only after its attempt can no longer produce audio
or callbacks that affect a newer attempt. Repeated stop is idempotent and stale
attempts cannot stop newer audio. `dispose` has the same cleanup guarantee and
unsubscribes listeners. Controller STOP invalidates callbacks immediately, then
awaits executor stop and main lease release before enabling another pad or edits.
The existing playback reducer still returns stopped as an intention. It is not an
authorization gate. Runtime enforcement belongs to B1/I1.

Writes compare expectedRevision atomically and increment revision once per
committed change. Storage checks catalog referential integrity, uniqueness and
reorder permutations against the persisted catalog. DTO schemas validate shape,
not database integrity. Future catalog schema versions must surface FutureSchema,
never initialize a replacement catalog. Operation rejections are normalized to
operationErrorSchema at IPC boundaries. Technical diagnostics stay in main.

## Discovery and integration

Vitest and TypeScript discover contract, storage, playback and Electron TypeScript
tests in addition to domain tests. Stryker retains the 100% threshold and adds P0
runtime schemas plus storage/library and renderer/playback implementations as
those lanes land. App-info shell wiring remains outside mutation scope. C1's
packaged automation needs its own launch command from the integrator. P0 changes
no bootstrap, preload, CI, dependencies or Electron wiring.

No physical performance metric applies to pure schemas and transitions. Mac,
Windows, packaged playback, SQLite and real audio/device evidence remain pending
S1/C1/I1/R1. No live audio change or runtime smoke pass is claimed.
