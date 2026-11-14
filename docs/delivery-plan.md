# V1 delivery and parallel work plan

The remaining I1 work is partitioned into M1 (local protocols) and J1 (finite
bridge/catalog service). Their interfaces and ownership are in integration-seams.md.
I1 now follows both modules and owns composition and the real application journey.
Two previous broad delegations returned foundations without an external blocker;
the smaller partitions make acceptance specific to each complete module.

Status: contracts, storage, playback and shell harness are integrated and verified
within their module scopes. Runtime integration and the editing UI remain.
The dispatch state and acceptance evidence are recorded in .pstack/work.json.
The accepted behavior is in spec.md. Follow architecture.md and verification.md.

## Working agreement

Use at most three implementation workers and one integrator. Each worker uses an
isolated worktree/branch, with a declared base commit, owned paths and a concrete
acceptance scenario. Independent tasks branch from published main; dependent tasks
start from the required published prerequisite commit. Do not merge incomplete
prerequisites just to create parallel activity.

The integrator owns src/contracts, shared domain changes, bootstrap/preload wiring,
package/lockfile, tool configurations and CI. Workers propose changes to these
files through the integrator before proceeding. Feature tests live alongside each
worker's owned test area; separate worktrees avoid guardrail fixtures interfering
with other agents' typechecks or mutation snapshots.

Every implementation PR includes requirement/scenarios, actual commands and exit
codes, mutation counts/scope/triage and relevant artifacts. Extend mutation scope
as behavior-bearing modules land; no threshold reductions or broad exclusions.
Enum values use objects as const with derived types and named members. Tests may
contain literal serialized fixtures to assert the wire contract independently.

Merge through review and passing required checks. Configure host branch protection
once GitHub access/plan supports it; workflow YAML alone is not protection.
A reviewer checks intent and test oracles as well as code. Automated checks cannot
approve weakening themselves. Final integration and release are serialized.

## Wave 0 — contracts and feasibility

### P0 — Freeze operation contracts and test seams

Owner: integrator. Depends on: published scaffold.

Define asset/pad/repertoire DTOs and IDs, error codes, revision model, finite desktop
operations, playback/edit/recovery lease interface and audio executor interface.
Use Zod at runtime ingress, const-object enums, deterministic IDs/clock inputs and
explicit unsubscribe. Define busy/starting/stopping semantics so reducer STOP never
prematurely authorizes editing. Keep pause/loop/autoplay absent.

Deliver contract/schema tests including invalid payloads, sender/session authority
and future schema versions. Contract changes affecting parallel tasks get an
explicit compatibility note before those tasks continue.

### S1 — Packaged runtime probes

Owner: integrator with target-platform runner. Can prepare probes alongside P0.

Prove SQLite driver create/reopen/rollback/FK/migration and byte-range media
streaming in packaged Electron on Windows/macOS. Measure first sound/STOP and
memory with a real long file on the target Mac/interface. Record runtime versions,
codec acceptance and device behavior; agree acceptable latency with the drummer.
Choose node:sqlite only after checking the pinned runtime/API status; document any
driver change. No driver fallback silently changes the chosen architecture.

Gate: host SQLite checks support provisional adapter integration; packaged runtime checks gate the candidate. Physical Mac checks occur after the complete candidate is delivered. Audio engine/protocol must
pass before show readiness; deterministic controller work can proceed behind the
agreed interface while physical output is pending. Do not restrict accepted formats
to WAV by assumption or promise untested codec compatibility.

## Wave 1 — three independent lanes after P0

### A1 — Catalog and managed storage

Owned paths: src/main/storage, src/main/library and tests/storage.
Depends on: P0; host SQLite tests support provisional integration. Packaged compatibility is verified automatically when available; physical Mac validation stays at final acceptance.

Implement SQLite schema/migrations and one writer; separate audio assets, pads and
one default repertoire. Persist stable IDs, labels/colors and ordering without a
30-pad limit. Import stages/copies/validates/promotes files before publishing DB
references. Delete records durable cleanup before unlink; recovery repeats cleanup
and surfaces missing files/corruption. Preserve originals and never reset an
unreadable catalog silently. Library operations require the agreed edit lease.

Acceptance: import then move/remove original, reopen and compare internal bytes;
rename/reorder survives restart; 31+ pads work; delete affects only managed copy;
copy/commit/unlink failure and process death at each handoff recover predictably.
Integration uses real SQLite/temp directories, not only mocked repositories.
Mutation covers migrations/validation/coordination/recovery logic.

### B1 — Playback controller and audio adapter

Owned paths: src/renderer/playback and tests/playback.
Depends on: P0. Uses a fake asset resolver until A1 is integrated.

Implement one controller owning attempts and one eligible HTMLAudioElement through
a small adapter. Reserve busy state synchronously; request/release main leases;
correlate asynchronous results; STOP invalidates immediately and cleans up before
unlock. UI receives a snapshot, not raw element access. Show duration/progress
without treating events as proof of physical audio.

Acceptance: A->B without STOP ignored; A->STOP->B works from zero; double-click,
STOP during acquisition/play, delayed grant/started/ended/error, failed release
and disposed session never resurrect playback or release another attempt's lease.
Test active resources, not just mock call counts. No sleeps as race synchronization.
Mutation includes controller/adapter behavior; test actual DOM adapter in a suitable
runtime in addition to controlled doubles.

### C1 — Verification harness and packaged probes

Owned paths: tests/electron, scripts/verification and docs/verification.md.
Depends on: P0; initial shell can be driven before A1/B1.

Build portable launch/doctor/drive/evidence/cleanup commands with an isolated
userData profile. Drive accessible controls with Electron automation, preserve
traces/logs/reports before cleanup, and stop only owned processes. Add runtime
version/SQLite probe from S1. Propose CI and launch-option changes to integrator.
Use synthetic redistributable stereo fixtures with known channels/hashes.

Acceptance: fresh app starts stopped, exact build/profile identified, app-info
bridge works, forbidden sender/navigation rejected, failure retains artifacts,
cleanup leaves the real user profile untouched. Demonstrate one real end-to-end
path before declaring harness ready. Add scenarios as A/B integrate.

## Wave 2 — integrate access, then three lanes

### I1 — Main coordination, media and IPC

Owner: integrator. Depends on: P0, A1 and B1 interfaces.

Implement main arbitration of idle/playback/edit/recovery without an await between
check/reserve. Validate payload/result and expected sender/frame/origin; bind leases
to window session and attempt. Import reserves before opening dialog. Serve local
UI/media through authorized custom protocols by ID, with streaming/ranges,
cancellation and confinement to managed files. No arbitrary paths or generic IPC.
Wire bootstrap/preload to catalog and controller; release on session destruction.

Acceptance: real import->persist->play->STOP->delete via C1; competing edits and
play never overlap; range/HEAD/invalid ID/traversal fixtures pass; renderer crash
and stale session fail safely. Preserve sandbox/CSP/fuses. Extend graph/lint rules
for actual audio/SQL/IPC effect sites and test attempted bypasses.

### A2 — Recovery and lifecycle hardening

Owner: lane A. Depends on: I1. Own storage/library recovery tests and agreed main
lifecycle modules; bootstrap changes stay with integrator.

Exercise corruption/future schema, staging/orphans, disk full, Windows open handles,
crash between publication/cleanup and restart. Close confirmation only while busy;
no background/hidden playback after closing; suspension/recovery starts stopped.
Power-save handling and device failure get explicit cleanup. No automatic resume.

### B2 — Performance view and editing UI

Owner: lane B. Depends on: I1 contracts and integrated snapshots.
Owned paths: src/renderer/performance, src/renderer/editing, renderer entry/styles.

Use shadcn/ui primitives per ui.md, with shared dependencies/build changes owned
by the integrator. Grid for 20–30 tracks with scrolling, active/busy states, fixed STOP/name/remaining
/progress. Edit mode only after confirmed stop/release. Batch import, labels, small
palette, drag reordering and confirmation on deletion; accessible mouse/keyboard
controls and clear errors. Save state is truthful; no implementation details leak
into musician-facing UI. All playback intentions go through controller.

Acceptance: operate real repertoire flow through C1, reordering persists, active
pad cannot restart, editing cannot interrupt audio, STOP remains accessible while
scrolling and error never advances to another track.

### C2 — Generated sequences and platform regression

Owner: lane C. Depends on: I1; extend as A2/B2 land.

Add small independent model/property tests of attempts, grants, edits and failures;
save seed/shrunk sequence. Full end-to-end flows exercise real protocol, bridge,
DB/files and DOM audio, including restart. Add negative governance fixtures for
new effect sites. Integrator wires commands into CI and uploads artifacts.

Acceptance: deterministic reproduction of stale-callback and cleanup regressions;
controlled broken variants are rejected where Stryker cannot generate the failure;
Windows/macOS package matrix plus runtime smoke with explicit supported formats.
No CI event is labeled proof of physical audio output.

## Wave 3 — release candidate, serial acceptance

### R1 — Integrator release gate

Depends on: A2, B2 and C2. Build and deliver the complete candidate before requesting S1 target-hardware validation.

Run verify from clean lockfile install; full mutation with reviewed inventory and
zero unexplained survivors/NoCoverage; governance fixtures and security checks;
packaged Windows/Mac smoke; installed app with actual repertoire for hours offline.
Measure sound onset/STOP, stereo routing and device unplug/replug/sleep behavior on
target Mac. Confirm original files survive import/delete and state reopens stopped.
Document supported codecs, known device limitations and recovery steps.

Produce versioned artifact for the actual Mac architecture. Signing/notarization
requires Apple credentials if that distribution path is selected; unsigned local
trial must be labeled as such and is not equivalent to signed release validation.
Check first launch/quarantine on the intended delivery path. No automatic updater
or separate library/repertoire UI is part of this release.

V1 is done only when product scenarios pass on the drummer's setup, not merely
when all branches merge. Record remaining external prerequisites honestly.

## Critical path and next dispatch

Published baseline -> P0 -> A1/B1 + I1 -> A2/B2/C2 -> R1.
C1 runs alongside A1/B1; S1 prepares early and blocks choices it invalidates.
The first implementation dispatch after contract freeze is A1, B1 and C1, each
with its own worktree, owned paths and explicit base SHA. Keep shared configuration
changes with integrator to avoid three competing pipelines or overlapping edits.

External inputs still needed before hardware acceptance: target Mac/architecture,
audio interface, representative prepared files and latency expectation. These do
not block contract/test work and must not be silently replaced with assumptions.

## Operator delegation

The operator delegates code review and integration to the coordinator. Integrate
verified changes without awaiting operator approval. Build the complete candidate
first; the operator validates the Mac only at the end. R1 can produce that
candidate while S1 physical acceptance is blocked. Automated integration evidence
does not claim the missing physical checks passed; show readiness still requires
them.

### I1 partial implementation checkpoint

The main-process session authority and its behavioral tests are implemented.
Discovery includes IPC/media/integration tests and mutation includes main IPC
modules. This checkpoint does not complete I1. Bootstrap/preload integration,
restricted UI/media protocols, dialog reservation, staged metadata inspection,
privileged-boundary negative guardrails and the import/persist/play/STOP/delete
journey remain pending. No playback, packaged-media or physical-performance
acceptance follows from this checkpoint.

The I1 continuation adds the staged-file metadata adapter and media/integration
TypeScript discovery. Bootstrap, protocol and renderer integration are still
pending. The current real Electron harness continues to exercise only the empty
shell. No import/persist/play/STOP/delete acceptance has been established.
