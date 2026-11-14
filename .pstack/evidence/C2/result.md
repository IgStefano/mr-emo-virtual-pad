# C2 evidence

Base is `806a3fbaf8b3f178ae47724afa4d3fbcccdafa12`, checked before editing.
Only C2-owned paths changed. No production modules, dependencies, fuses, shared
configuration or other lanes were modified. Head is the commit containing this
file. Coordinator owns publication and integration.

## Observed scope

- The real PlaybackController passes 128 seeded bounded schedules (eight unique
  flag combinations), with an independent resource eligibility oracle.
- SessionAuthority passes 400 seeded exclusive edit/play/stale-release commands.
- Controlled broken cancellation starts audio after STOP. Seed 1, index 1 shrinks
  from `[true,true,false]` to `[true,false,false]`.
- Controlled broken cleanup unlocks after failed release. Seed 1, index 0 shrinks
  to `[false,false,true]`. Both variants exit 1; baseline exits 0. These two
  controlled variants are separate from Stryker mutation counts.
- Linux fused package opens the SQLite catalog seeded by a real unpackaged import,
  decodes synthetic stereo PCM through a 206 pad-media response, progresses,
  and returns to stopped after STOP. Package child exit is asserted. Source bytes
  were compared before removing the generated original. This is not packaged
  native-picker import or physical output acceptance.
- Three alias governance cases are rejected by existing ownership/unbound-method
  rules. The third uses the unbound-method guard, not the audio-owner rule.

## Commands and results

- `npm ci` exited 0 (dependencies were absent).
- `npx vitest run tests/model` exited 0, two tests.
- `node scripts/verification/regressions.mjs` exited 0. Latest retained copies and
  logs are `reports/verification/regressions-1h4y64`.
- `node --test tests/electron/guardrails.test.mjs` exited 0, three tests.
- `npm run package` initially exited 1 because Forge's shared `/tmp/electron-packager`
  template disappeared. Retrying with an isolated `TMPDIR=$PWD/reports/verification/package-temp`
  exited 0. No package settings or fuses changed.
- With the documented host LD_LIBRARY_PATH,
  `node scripts/verification/packaged-shell.mjs --playback` exited 0. Artifacts are
  `reports/verification/packaged-3Fu6Pa`; profile `/tmp/pad-packaged-RvMVDB` persists.
  Committed result and child-exit output are beside this file.
- Initial `npm run verify` exited 2 on new test TypeScript errors, subsequently fixed.

## Integration and gaps

Apply `integrator.patch` to add explicit regression/native scripts and include the
new Node governance fixture in routine discovery. Vitest/TypeScript model discovery
and mutation scope already cover the tested production modules at the base.
The patch proposes no threshold reduction. Coordinator must reconcile accessible
selectors after B2. No delete-button layout is frozen by the new packaged journey.

Windows/macOS execution, packaged native-picker import, target codecs, physical
Mac/interface output, device/long-session behavior and physical latency remain
unverified. No performance number was measured. This bounded contract model
requires no physical performance baseline and makes no such claim.

The next `npm run verify` exited 1 after passing static gates, with 170/171
behavior tests passing. The existing real catalog-session test exceeded its
5000 ms deadline. `npm test` and `npm test -- --maxWorkers=2` also exited 1
on that deadline. `npx vitest run tests/ipc/catalog-session.test.ts` exited 0,
all seven tests passing. The Stryker dry run passed all 171 tests. Contention is
a hypothesis, not an established diagnosis; no shared timeout was changed.

`node scripts/verification/packaged-shell.mjs` without playback also exited 0,
using a fresh profile. Its persistent report is `packaged-shell-linux.json`.
The final playback run additionally waits until Import is actionable after STOP,
so stopped text alone does not authorize successful cleanup.

## Fresh continuation provenance

The predecessor stopped at the provider quota before final acceptance. The recovery
script restored 16 SHA256-checked files onto the exact clean required base in this
provided checkout. The preserved snapshot represents predecessor commit
`a8aaec3a7a6d653543da9adb54b082c3666c8023`; it was not cherry-picked.
I read the restored diff and reran verification rather than accepting prior logs.
Dependencies were absent. `npm ci` exited 0. An early verify launched before the
install finished exited 127 because Prettier was absent; the subsequent run waits
for the completed install. No deadlines, thresholds or shared configs changed.

Fresh controlled regressions exited 0, with baseline exit 0 and both faulty
variants exit 1 on product assertions and retained shrunk traces. Three new
governance fixtures passed with exit 0. `npm run pstack:ready` exited 0.
Packaging with lane-local TMPDIR exited 0. Both the unpackaged journey and fused
packaged playback exited 0 with the documented LD_LIBRARY_PATH. Fresh JSON and
cleanup logs are committed beside this file; full copies, screenshots and profile
are under reports/verification/packaged-DRXLmH and journey-X2gRa5. The packaged
profile /tmp/pad-packaged-zJMvef persists; its owned child exited.

Test Behavior, Not Implementation shaped the retained oracle checks. The faulty
variants must cause canceled audio to start or cleanup to unlock prematurely.
No physical-performance number is inferred from these checks.

The first installed full verify passed every static gate, all 171 behavior tests
and the Stryker dry run, then exited 143 during mutation execution without a
final report. No product assertion failure was logged. Termination cause is
unestablished; this is not a mutation pass. The log is preserved at
reports/verification/c2-verify-terminated.log. A complete retry follows.

The complete retry `VITEST_MAX_WORKERS=1 npm run verify` exited 0. Every
static gate and all 171 behavior tests passed. Stryker detected all 975 mutants
across 20 files, with 974 Killed and one Timeout, zero survivors/NoCoverage.
Timeout mutant 804 removes the zero-byte-read error guard at line 147; Stryker
reported hit limit 1501/1500. It is separately identified in the summary rather
than counted as an assertion kill. Full JSON/HTML remain reports/mutation.
The fresh verification log is reports/verification/c2-verify.log.
