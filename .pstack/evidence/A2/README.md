# A2 recovery and lifecycle evidence

Base `806a3fbaf8b3f178ae47724afa4d3fbcccdafa12` matched before edits.
The implementation commit containing this file is the handoff head.

The drummer's imported originals survive recovery and deletion. Main now waits
for privileged operations and renderer-session cleanup before allowing exit.
A native close asks for confirmation while a playback lease remains active.
Cancel retains the window. Confirm destroys renderer audio before session cleanup.
Suspension destroys the renderer and exits. Reopening starts stopped.

`ApplicationShutdown` owns the quit decision through ports. Reentrant requests
share cleanup. A canceled close permits another attempt. Cleanup failure reports
the error and keeps quit unauthorized. `RendererLifetime` shares concurrent
termination, preserves failed cleanup for retry, and drains pending imports.

`tests/storage/catalog.test.ts` runs the actual catalog in child Node processes.
The child dies with SIGKILL after staging, promotion, import commit, deletion
commit, and unlink. Two real reopens must converge. Unpublished copies move to
quarantine, committed imports remain available, and durable cleanup repeats safely.
Original bytes are checked after every restart. POSIX directory permission denial
retains cleanup intent across reopening. Restoring permission permits cleanup.
The open-handle test exercises the host's actual unlink behavior.
Existing tests cover corrupt and future catalogs without resetting them, missing
media, staged files, symlinks, and SQL failures.

`tests/lifecycle/pending-import.test.ts` holds validation after a real copy.
Termination cannot close SQLite until the import completes. The managed copy and
original remain readable after reopening, and authority permits a new session.

`runtime.mjs` drives real unpackaged Electron with a disposable profile.
`runtime.json` records its successful observations. The native window closes while
the import dialog port is pending. Main remains alive with no window, finishes the
copy after selection is delivered, and exits. Reopening exposes the imported pad.
The probe cancels a playback close, emits a synthetic suspend, reopens stopped,
confirms a playback close, and reopens stopped again. Dialog choices are injected.
This does not simulate physical silence or an actual OS power transition.

The throughput checkpoint kept shared contracts, preload, dependency manifests,
CI, and check configuration read-only. Lifecycle discovery and mutation scope were
already prepared. No shared patch is required. No nested agents were started.
Test Behavior, Not Implementation shaped the assertions on persisted bytes,
visible catalog state, process exit, and session ownership. Type System Discipline
kept lease kinds derived from their contract and used the existing const object.

## Runtime limits

Host evidence is Linux x64 with Node 24.21.0 and Electron 45.3.2.
Physical Mac power, device unplug, output routing, sound onset, and STOP latency
remain BLOCKED for the final target runner. No performance measurement is claimed.
There is no baseline or physical hardware available for such a measurement here.
Windows handle-denial and permission semantics were not executed. The POSIX mode
test explicitly skips Windows. Existing host symlink tests are not Windows proof.

## Verification record

`npm ci` exited 0. It installed 624 packages and reported 11 moderate advisories.
Dependencies and lockfile were not changed.

Focused storage tests exited 0 with 35 tests. Focused lifecycle and lifetime tests
exited 0. Focused lint exited 0. `pstack:doctor` and `pstack:ready` exited 0.
The initial `npm test` attempt exited 127 because dependencies were absent.

Full `npm run verify` attempts exited 1 first for a corrected lint error, then for
a corrected new test type error, and twice for the unchanged catalog-session test's
5000 ms timeout under concurrent host load. Its focused rerun passed all 7 tests.
The first mutation attempt exited 1 during its initial test run for that same
timeout. No mutants were scored by that failed run. The subsequent verification
uses `VITEST_MAX_WORKERS=1` without changing check settings or timeouts.

Linux `npm run package` exited 0. One repeat exited 1 because the shared packager
temporary directory disappeared. Repeats with `TMPDIR=/tmp/a2-package-temp`
exited 0, including the current lifecycle wiring.

The successful native probe command exited 0:

```sh
LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu node .pstack/evidence/A2/runtime.mjs
```

Earlier probe attempts failed or were terminated while correcting readiness and
native closed-event synchronization. They are not acceptance evidence.

The complete single-worker Vitest run exited 0 with 182 tests across 16 files.
An evidence-script lint declaration was corrected after another verification
attempt exited 1. No check policy changed.

The existing native `scripts/verification/journey.mjs` command exited 0 with the
same runtime library path. `existing-journey.json` preserves its result. Its
Reload menu and Ctrl/Cmd+R and F5 document-retention checks passed.
The complete verification reached mutation after all static gates and all 182
tests passed with `VITEST_MAX_WORKERS=1`.

`WindowLifecycle` now owns close confirmation and suspend decisions inside the
mutation scope. Main contains only the Electron adapters. Its focused lifecycle
suite exited 0 with 5 tests. Packaging and the native probe were repeated after
this extraction and exited 0. Existing playback error handling remains the owner
of DOM audio failures. Physical device unplug behavior is still a target gap.

## Changed paths

- `src/main/main.ts` wires lifecycle ports and awaits termination before quit.
- `src/main/ipc/renderer-lifetime.ts` tracks playback and shares termination.
- `src/main/lifecycle/shutdown.ts` owns quit authorization.
- `src/main/lifecycle/window.ts` owns close and suspend policy.
- `tests/ipc/renderer-lifetime.test.ts` covers playback and concurrent termination.
- `tests/storage/catalog.test.ts` covers actual process death and host filesystem failures.
- `tests/lifecycle/pending-import.test.ts` covers real import shutdown.
- `tests/lifecycle/shutdown.test.ts` covers cancellation, draining, and retry.
- `tests/lifecycle/window.test.ts` covers confirmation and suspension.
- `.pstack/evidence/A2` contains this record and executable native evidence.

The process-death test uses abrupt exit code 91 on Windows, where POSIX SIGKILL
status is unavailable. Linux executes and asserts SIGKILL. The Windows branch
has not been executed on this host and is not Windows acceptance evidence.

## Fresh continuation provenance

The predecessor stopped at the provider usage limit without a commit or final
mutation result. This checkout restored exactly 13 files using the prescribed
`reports/recovery/restore.py` and `A2.json` from the project checkout. The restore
verified the clean exact base and captured SHA256 values and exited 0. No original
checkout was modified. Restored results above are predecessor evidence.

This continuation read the actual restored diff and added failed-termination retry
coverage and managed-byte assertions after each process-death restart. `npm ci`
exited 0. An initial verify exited 127 before that install. The first installed
verify exited 1 on conditional-expect lint in the restored Windows death assertion;
the assertion now compares the complete platform-specific termination result.
No lint rule, timeout, threshold or shared configuration was changed.

`TMPDIR="$PWD/reports/a2-package-temp" npm run package` exited 0 on Linux x64.
The native runtime probe command documented above was rerun and exited 0. It
reproduced all five observations in `runtime.json` on this checkout. Target Mac
physical power/device/output evidence remains BLOCKED. No performance is claimed.

The continuation's next verify passed every static gate and all 185 tests across
17 files. Mutation's instrumented initial run also passed all 185 tests, but the
parent command exited 143 before a score or report. This interruption has no
mutation acceptance value. A fresh complete verify writes its exit status to
`reports/a2-verify.exit` independently of the tool session lifetime.

The existing journey was rerun after packaging and exited 0. Its output directory
was `reports/verification/journey-OF0Krk`; `existing-journey.json` now contains this
continuation's result. Its script asserts absent reload menu roles and retained
document identity after Ctrl/Cmd+R and F5.

The detached retry did not persist or produce an exit record. The foreground
terminal retry of `VITEST_MAX_WORKERS=1 npm run verify` exited 0. All static gates
and 185 tests in 17 files passed. Full mutation scored 100%, with 1027 mutants,
1024 killed and 3 detected by timeout, zero survivors or uncovered mutants.
`verify.log` preserves the complete successful run; `mutation-counts.json` records
per-module counts. Full HTML and JSON reports are in ignored `reports/mutation`.
