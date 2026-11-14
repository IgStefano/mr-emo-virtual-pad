# I1 composition handoff

Base: `86234a7360e9e340def4f359853bb32bab9031d9` (verified before editing).
The committed head is obtained with `git rev-parse HEAD`; no publication or merge
is performed by this implementation worker.

The built unpackaged Linux app imports the real synthetic stereo PCM fixture
through the finite preload bridge, reserves edit authority before the controlled
native dialog, validates the copied staging file and persists identical bytes.
After removing the source and restarting with the same disposable profile, native
audio advances through a real restricted media 206 response. STOP permits editing
again. An OS-killed playback renderer exits; reopening starts stopped. Deletion
removes the managed copy. Each launch asserts the exact main-process userData and
sandbox/context isolation/Node settings. Physical output is not inferred.

Main composes accepted M1/J1 exports. RendererLifetime captures main-side session
identity and drains lost pending open responses after renderer termination. Its
public tests include concurrent completion order, failed disposal and cleanup
retry. PlaybackController and DomAudioExecutor are unchanged and remain the only
playback/native-audio owners. The React shell composes shadcn/ui's Button pattern;
B2 retains the polished grid/editor scope.

Changed paths: main bootstrap and `main/ipc/renderer-lifetime.ts`; renderer entry,
CSS, runtime, Button and class utility; dependency manifest/lock; mutation config;
Electron harnesses and integration/lifetime tests; graph/lint rules and negative
fixtures; architecture, delivery, UI and verification docs; this evidence folder.
No accepted storage, service, protocol or playback implementation was replaced.

Observed commands:

- `npm ci`: exit 0.
- Focused runtime/lifetime tests: exit 0, seven tests before the class utility
  case; `npm test`: exit 0, 169 tests including that case.
- `npm run verify`: exit 0; standalone inventory is 973 Killed / 1 Timeout,
  no survivors or uncovered mutants. JSON is `composition-mutation.json`.
  That run covers 19 files and predates adding the class utility to mutation.
  The normal commit hook runs the full current scope and its console log is
  retained locally as `composition-normal-hook.log`.
- `npm run package`: exit 0, Linux x64 release fuses retained.
- `npm run test:guardrails`: exit 0, 32 tests including actual IPC/filesystem
  and alias-aware native audio bypasses.
- `npm run verify:static`: exit 0.
- With the documented LD_LIBRARY_PATH, `node scripts/verification/journey.mjs`,
  `npm run verification:drive`, and
  `node scripts/verification/packaged-shell.mjs`: each exit 0.

An earlier mutation run failed with two survivors because release-failure
propagation lacked an oracle. The added behavioral test requires STOP to retain
busy authority on release failure and unlock only after a successful retry.
No threshold, skip, exclusion or mutant suppression was added. The inherited
single Timeout removes the media EOF guard and causes nontermination.

Artifacts: `composition-journey/` contains result, stereo manifest and screenshot;
`composition-shell/` records build hashes/diff, actual runtime settings, sender
rejection and result; `composition-packaged-shell.json` records the supported
renderer-CDP package smoke; `composition-fuses.json` is read from the binary.
The generated package is under `out/Mr. Emo Virtual Pad-linux-x64`.

Remaining gaps: packaged import/native playback has not been proved; the fused
package smoke proves restricted UI, bridge and SQLite/recovery startup only. Main
inspection fuses remain disabled. Exact main userData is asserted in unpackaged
runs, not inspected through the fused package. Mac/interface physical stereo,
start/STOP latency and representative codec acceptance remain final-candidate
checks. No benchmark or performance number is claimed. B2/A2 product work remains
as scheduled in the delivery plan; this handoff does not claim V1 show readiness.
