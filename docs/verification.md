# Verification recipe

## Static and deterministic

Use Node 24 (see engines) and `npm ci`, then `npm run verify`. This runs formatting,
strict lint, environment-specific typechecks, resolved import graph, negative
policy fixtures, domain tests and Stryker. Mutation artifacts survive in
`reports/mutation/`. The postcheck rejects empty scope and non-detected/invalid
mutants, and reports timeout count. Current small scope has no ignored mutants.

Use `npm run package` for Electron changes. CI also makes unsigned ZIP artifacts
on Windows/macOS. Signing/notarization and runtime smoke on those platforms are
not established by a successful Linux build.

## Live shell

Launch with `npm start` on a desktop with Electron system dependencies. Confirm
empty-repertoire screen, stopped status and clean window closure. This shell
cannot import/play audio yet; never report its empty state as a playback test.
Linux headless hosts may need Xvfb and Chromium system libraries; sandboxing must
remain enabled for production. There is no automated Electron UI driver yet.

When adding runtime features, provide launch/doctor/drive/evidence/cleanup scripts:
use an isolated temporary userData directory, identify the build/platform/runtime,
drive accessible controls, assert visible state plus disk/resources, save artifacts
before teardown, and terminate only processes created by that run. Never use the
real repertoire as a test profile. This recipe is a specification for that future
harness, not a claim it already exists.

## Evidence

Record git SHA and dirty diff, platform, Node/Electron versions, commands and exit
codes. Preserve test/mutation reports; add seeds, correlated attempt traces and
filesystem snapshots for new concurrency/storage scenarios. CI uploads mutation
reports even on failure. Logs aid diagnosis; they are not the sole oracle.

Before show readiness: packaged app on the target Mac and interface, real accepted
files, physical click-to-sound and STOP-to-silence checks, stereo routing, long
session, unplug/suspend and recovery. No fake or `playing` event proves physical
output quality.
