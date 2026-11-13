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
remain enabled for production. The isolated C1 driver below automates the empty shell.

When adding runtime features, provide launch/doctor/drive/evidence/cleanup scripts:
use an isolated temporary userData directory, identify the build/platform/runtime,
drive accessible controls, assert visible state plus disk/resources, save artifacts
before teardown, and terminate only processes created by that run. Never use the
real repertoire as a test profile. The C1 driver implements the empty-shell portion; future product journeys
still require integration.

## Evidence

Record git SHA and dirty diff, platform, Node/Electron versions, commands and exit
codes. Preserve test/mutation reports; add seeds, correlated attempt traces and
filesystem snapshots for new concurrency/storage scenarios. CI uploads mutation
reports even on failure. Logs aid diagnosis; they are not the sole oracle.

Before show readiness: packaged app on the target Mac and interface, real accepted
files, physical click-to-sound and STOP-to-silence checks, stereo routing, long
session, unplug/suspend and recovery. No fake or `playing` event proves physical
output quality.

## C1 isolated shell harness

Build first with `npm run package`. Then run these from the repository root on a
supported desktop with the pinned Node and Electron dependencies installed.

- Doctor. `node scripts/verification/run.mjs doctor` records host/runtime loader
  diagnostics. Exit 2 means the runtime probe failed. This is not a live UI pass.
- Launch and drive. `node scripts/verification/run.mjs drive` launches development
  Electron against the built `.vite` bundles. This is explicitly **unpackaged**,
  even though packaging produced the bundles. Release fuses remain unchanged.
- Fixtures. `node scripts/verification/run.mjs fixtures` generates a one-second
  stereo PCM WAV and hash/channel manifest. Original synthetic samples are
  dedicated to the public domain under CC0-1.0. They require no external media.
- Fixture check. `node --test tests/electron/fixtures.test.mjs` checks actual WAV
  bytes and channel isolation without launching Electron.

Each invocation prints a unique persistent directory under `reports/verification`.
Drive records exact git SHA, dirty tracked diff, untracked file names, bundle
SHA-256 hashes, profile path, runtime versions and resolved userData. It requires
resolved userData to equal the newly created absolute temporary directory. It
asserts the accessible empty heading/status, app-info bridge version, sandbox,
context isolation, disabled Node access, rejected foreign-window sender and
blocked navigation/new windows. It saves screenshot, HTML, trace, logs and final
result. Failure artifacts survive teardown. Launch errors appear in result.json.
Only the application handle created by Playwright is closed. Only that run's
newly created temporary profile is removed, after listing its files. There is no
PID-based external cleanup command that could target an unrelated application.

Exit 0 means the requested check passed, 1 means an assertion/tool/build error,
and 2 means a recognized runtime prerequisite blocked live execution. The result
file is authoritative for the drive verdict. Do not label missing GTK, display or
Mac hardware as PASS. Do not pass `--no-sandbox` or weaken fuses to obtain a pass.
A missing build requires rerunning package. Separate concurrent invocations use
separate profiles and evidence directories.

The standalone MJS journey is intentionally outside the Node Vitest mutation
runner. It currently proves only the empty shell. Packaged release automation,
SQLite probe integration, import/play/STOP/delete and physical output remain
separate gates. No latency or throughput is measured by this harness.
