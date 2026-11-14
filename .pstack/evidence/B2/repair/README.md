# B2 repair evidence

Required dependent base: 92243b08e12046d668d7c68c46158a8dd0235bd0.
The initial checkout matched exactly and was clean. No coordinator C2 changes,
backend, protocol, shared check configuration or verification scripts were changed.
Original B2 evidence is retained; independent review originals were read only.

## Model and behavior

Name drafts belong to Pad, keyed by pad ID, rather than the conditionally mounted
Editor. Blur does not write. Salvar nome explicitly saves; every subsequent editing
action first saves pending names, then performs that action. A failure retains
unwritten drafts, prevents concluding, and does not perform the dependent action.
Successful names already written before a later failure remain truthful.
Controls stay disabled during saving and playback remains exclusively owned by
the existing controller/audio executor.

Runtime rereads the authoritative catalog after a finite mutation error, before
rethrowing that error and releasing the edit lease. UI rereads runtime.catalog on
failure. A deletion committed before unlink failure disappears immediately, and
cleanup-required explains that reopening retries cleanup. This warning persists
after subsequent successful saves until the application reopens. Uncommitted deletion
failure keeps confirmation open with the error inside the modal.

Controlled Radix close focus returns to the captured delete control if connected,
otherwise to the edit control after successful deletion.

## Reproduction and regression probes

All probes run from repository root and resolve this checkout's source or build.
Original probes asserted old failures; these retained adaptations assert repair.
No Tab or intermediate save waits occur between typing and native action clicks.

- recovery.mjs: real ManagedCatalog, SQLite, copied managed files and validated
  public desktop API. ManagedFiles.remove is temporarily forced to throw.
  Audio metadata acceptance is controlled. This is controlled unlink failure,
  not native OS unlink failure. Catalog/revision reconcile and subsequent
  rename/reorder/import pass. The same behavior has a Vitest integration regression.
- native-flows.mjs: sandboxed Linux Electron, real bridge/SQLite, 31 PCM fixtures.
  Native file selection is injected. Direct color, move, delete and conclude
  clicks save the name and perform their action. Cancel restores delete focus.
- drafts-focus.mjs: Chromium and actual Radix with a controlled storage-failure
  port; failed rename prevents conclusion and retains the draft; retry persists
  it across leaving/reentering. Cancel and successful deletion restore focus.
  Controlled failed deletion keeps its modal and exposes an actionable error.
- journey.mjs: full unpackaged native 31-pad import, rename, color, reorder,
  restart persistence, progress/206 native media, playback locking, STOP while
  scrolling, deletion and byte-preserved original. Adapted only the explicit
  name save and evidence destination from the original B2 journey.

## Limits

No physical Mac/audio interface, Windows, physical sound or latency validation.
C2 packaged combined-UI verification belongs to the coordinator. Forge packaging
here is a build check, not packaged functional acceptance.
Existing Stryker scope covers runtime TS but excludes React TSX; actual native
and controlled-Radix probes provide UI evidence, not a UI mutation score.
Shared discovery/mutation configuration remains coordinator-owned.
No nested agents, publication or approval wait.

## Commands and exits

commands.json and final-probes.json record the executed focused/probe commands
and their zero exit codes. Package used
`TMPDIR=$PWD/reports/b2-repair/tmp npm run package` and exited 0.
Native runs used
`LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu`.
Chromium runs used
`PAD_CHROMIUM_EXECUTABLE=/home/igstefano/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
The first attempts lacked dependencies and failed with module-not-found;
`npm ci` then exited 0. Reproduction ran successfully before source edits.
Early lint attempts caught local promise/import/probe cleanup errors; these were
fixed without changing checks. The final verification logs carry the gate result.

The first complete mutation run failed at 99.90% with one surviving conditional:
refreshing unconditionally after successful mutations. A new runtime regression
proves a successful write returns its committed result even if a subsequent read
is unavailable. This kills the survivor without changing production behavior,
timeouts, scope or thresholds.

shared-ui-mutation.patch proposes the narrow shared mutation-scope addition for
React views. It is not applied: these views need a DOM-capable test runner before
that scope can pass. The current Node Vitest suite cannot mount Radix. The
committed Playwright probes execute the real UI but are not Stryker tests.
The coordinator owns that shared integration; this lane does not claim TSX
mutation coverage or reproduce C2 selector/discovery fixes.

Final `VITEST_MAX_WORKERS=1 npm run verify` exited 0: 176 tests passed;
1015 mutants, 1014 killed and 1 detected by timeout, zero survivors or uncovered
mutants. Runtime has 51 killed mutants. Full output is verify.log and the
compressed report is mutation.json.gz. No timeout settings changed.
Focused regressions passed 22 tests in six files.
The unapplied shared mutation patch passes `git apply --check`.
