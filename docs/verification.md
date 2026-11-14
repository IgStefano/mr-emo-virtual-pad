# Verification recipe

## Static and deterministic

Use Node 24 (see engines) and `npm ci`, then `npm run verify`. This runs formatting,
strict lint, environment-specific typechecks, resolved import graph, negative
policy fixtures, domain tests and Stryker. Mutation artifacts survive in
`reports/mutation/`. The postcheck rejects empty scope and non-detected/invalid
mutants, and reports timeout count. The gate accepts no ignored mutants.

Use `npm run package` for Electron changes. CI also makes unsigned ZIP artifacts
on Windows/macOS. Signing/notarization and runtime smoke on those platforms are
not established by a successful Linux build.

## Live shell

Launch with `npm start` on a desktop with Electron system dependencies. Confirm
empty-repertoire screen, stopped status and clean window closure. The empty-shell smoke checks launch and isolation; the product journeys below
check import and playback.
Linux headless hosts may need Xvfb and Chromium system libraries; sandboxing must
remain enabled for production. The isolated C1 driver below automates the empty shell.

When adding runtime features, provide launch/doctor/drive/evidence/cleanup scripts:
use an isolated temporary userData directory, identify the build/platform/runtime,
drive accessible controls, assert visible state plus disk/resources, save artifacts
before teardown, and terminate only processes created by that run. Never use the
real repertoire as a test profile. The C1 driver implements the empty-shell portion; the composed runtime and C2
drivers below check product journeys.

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
runner. It proves the empty shell. The I1 and C2 journeys below cover
import/play/STOP/delete and packaged playback. Physical output remains a
separate gate. No latency or throughput is measured by this harness.

The coordinator completed an unpackaged WSLg shell journey with GTK and epoxy
extracted into a user-local cache and supplied through LD_LIBRARY_PATH. The
committed evidence is in `.pstack/evidence/C1/coordinator-live`. This host setup
is not shipped with the app and does not establish Windows/Mac release behavior.

## I1 composed runtime

`node scripts/verification/journey.mjs` runs the built **unpackaged** application
with Chromium sandboxing explicitly enabled and a disposable userData directory.
It asserts `app.getPath('userData')`, imports the generated stereo PCM fixture
through the finite bridge (controlling only the native dialog boundary), compares
the managed bytes, removes the original and restarts. Native audio progress and a
206 response from pad-media are required before STOP. Deletion then requires an
empty managed-media directory. The profile is removed after evidence is saved.

`node scripts/verification/packaged-shell.mjs` uses renderer CDP against the fused
Linux package, without main-process inspection. It requires the restricted UI
origin, stopped state, a working finite bridge and no renderer require. This is a
packaged shell/SQLite/recovery smoke, not packaged import/playback evidence. Its
profile is supplied at launch; the exact main-process getPath assertion belongs
to the unpackaged journey. Release fuse values are inspected independently with
`getCurrentFuseWire`. No inspection fuse is disabled for verification.

On this host these commands need
`LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu`.
The full target Mac/interface journey, physical stereo output, latency and
representative codec acceptance remain unverified. No performance result is
inferred from native timeupdate events. Evidence is under `.pstack/evidence/I1`.

## C2 generated regressions and packaged playback

`tests/model` is included in Vitest and TypeScript discovery. It drives the actual
PlaybackController with controlled grant/start/release completion and a reduced
exclusive-resource oracle, independent of the domain reducer. Four fixed seeds
exercise 128 schedules. Failures print the seed, schedule index, original flags
and greedily shrunk flags. Flags represent STOP before grant, STOP before start
completion, and release failure. Main SessionAuthority additionally runs 400
seeded edit/play/release/stale-release commands against a single-token oracle.
These are bounded models, not an exhaustive proof of concurrency.

Run `node scripts/verification/regressions.mjs` for a baseline and two deliberately
broken controller variants in isolated copies. Logs preserve shrunk reproducers.
The variants remove late-grant cancellation and release acknowledgment. They must
fail because canceled audio starts or another pad becomes eligible while cleanup
has failed. This count is separate from Stryker mutations. Copies and logs remain
under the printed `reports/verification/regressions-*` directory.

Run `node scripts/verification/packaged-shell.mjs --playback` after packaging.
It seeds an isolated profile through a real **unpackaged** import with only the
native picker boundary controlled, compares managed bytes, removes the source,
then opens the catalog in the fused package. Renderer CDP observes the finite
bridge, SQLite catalog reopening, restricted 206 media response, native decode
progress and STOP. This does not prove packaged native-picker import. No release
inspection or sandbox fuse is weakened. `PAD_PACKAGED_EXECUTABLE` selects a package
path, including a different Mac architecture. The default follows host platform.
Reports and the isolated profile persist for reruns and diagnosis; the owned child
must exit before teardown completes. Routine shell runs no longer write tracked
I1 evidence. Windows and Mac execution still require those actual hosts.

No decode event or synthetic fixture establishes physical output, supported real
codecs, device behavior or latency. Physical Mac/interface acceptance remains a
final-candidate gate. These checks measure no performance metric.
