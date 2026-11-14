# I1 checkpoint — ISSUES

Base 97db707f39a9a587a514733d460f28866036947b.

Only the main session/lease authority foundation is implemented. It reserves
recovery before returning a session, excludes simultaneous reservations, validates
lease ownership and revokes failed or closed sessions. Tests use public methods.
It is not wired into bootstrap, preload, ManagedCatalog or PlaybackController.

Changed paths are src/main/ipc/authority.ts, tests/ipc/authority.test.ts,
tests/ipc/tsconfig.json, vitest.config.mjs, tsconfig.test.json,
stryker.config.mjs, docs/architecture.md and docs/delivery-plan.md, plus evidence.
No visible UI changed. Thresholds remain 100 and no mutants were excluded.

Observed commands:

- npm ci exited 0.
- npm run package exited 0. Linux x64 artifact is in out/. This is a build result,
  not packaged playback evidence. Fuses and sandbox settings were unchanged.
- LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu npm run verification:drive exited 0.
  The existing disposable-profile unpackaged shell journey passed. See
  shell-result.json and runtime.json. This journey covers an empty stopped shell,
  finite app-info bridge, invalid sender and blocked navigation only.
- First complete npm run verify exited 1. Static checks and 65 tests passed;
  mutation killed 498/501 with three survivors. The redundant post-recovery
  assertion was removed and released-lease/idle-close behavioral oracles added.
  Final npm run verify exited 0. All 66 tests passed and all 500 mutants were
  killed, with zero survivors, timeouts, uncovered mutants or errors. See
  verify.log and mutation.json.

Remaining work is substantive. Restricted custom UI/media protocols with ranges,
HEAD, cancellation and traversal rejection; staged-file metadata validation;
finite validated IPC, sender/frame/origin and main-generated session binding;
reserve-before-dialog editing; renderer composition with existing audio owners;
crash cleanup; actual privileged-boundary lint negative cases; and a real synthetic
stereo import/persist/play/STOP/delete journey are not implemented here.

No physical performance measurement was made. This isolated authority module has
no audio output or latency baseline. Mac/interface measurements remain deferred.
The full I1 task cannot be accepted from this checkpoint. No external blocker is
claimed for the unfinished implementation. Nothing was published or merged.
