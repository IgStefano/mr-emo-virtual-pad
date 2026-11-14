# I1 continuation — ISSUES

The requested complete integration is not delivered. There is no demonstrated
external blocker. This work must not be accepted as I1.

Base is c50808500e9b1c2aecf6e53bd7df15c979e0d81e. The final response identifies
the committed head. changed-paths.txt lists the changed paths.

Implemented the storage audio-metadata adapter with music-metadata 12.5.0.
It validates duration on an extensionless managed staging copy after the source
has been deleted. Invalid files and absent, zero, negative, NaN and infinite
durations fail with UnsupportedFormat. This follows Test Behavior, Not
Implementation through real filesystem effects and Type System Discipline through
Zod validation. The adapter is not yet wired into bootstrap.

Added a graph rule and negative case restricting the metadata parser to storage.
Enabled package exports resolution for dependency-cruiser. Added media/integration
TypeScript discovery. Existing mutation globs include the new storage adapter.
No thresholds, mutant exclusions, sandbox settings or fuses changed.

The prior foundation artifacts are preserved under authority-checkpoint/.
The unpackaged disposable-profile shell journey passes and asserts userData.
It covers only an empty stopped shell, app-info, forbidden sender and navigation.
It does not cover import, persistence, playback, STOP or deletion.

Remaining work includes finite catalog/playback IPC and preload, authorized
main-frame session wiring, recovery and pending-operation lifecycle, reserve before
dialog, restricted UI/media protocols with streaming/ranges/cancellation, renderer
composition, privileged-effect guardrails and the full stereo journey. The new
metadata adapter alone does not prove browser decode or protocol playback.
Linux packaging is a build result, not packaged playback evidence. Physical Mac
and interface validation remain deferred. No performance measurement was made.
This metadata change has no physical audio-output metric or baseline.

Observed commands and exits:

- npm ci exited 0. Dependencies were initially absent.
- npm install music-metadata exited 0 and pinned 12.5.0.
- npm test -- --run tests/media/audio-metadata.test.ts exited 0 with 7 tests.
- npm run architecture exited 0.
- npm run test:guardrails exited 0 with 25 tests.
- npm run verify:static exited 0.
- npm run pstack:ready exited 0.
- npm run verify exited 0 with 73 tests and 508/508 mutants killed. There were
  zero survivors, uncovered mutants, timeouts or errors. mutation.json and
  verify.log preserve these results.
- The first complete mutation run exited 1 with 515/516 killed and one surviving
  redundant undefined check. verify-first-mutation.log preserves it. Replacing
  handwritten duration checks with Zod removed the redundancy.
- Earlier verification attempts exited 1 for lint, a metadata fixture type and
  package-export graph resolution errors. These were corrected before the final
  full verification.
- npm run package exited 0 for Linux x64. package.log preserves the result.
- LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu npm run verification:doctor exited 0 after npm ci.
  Before npm ci it exited 1 because Electron was absent.
- LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu npm run verification:drive exited 0. runtime.json,
  shell-result.json and journey.log preserve the unpackaged shell evidence.
- The first git commit exited 1 after passing verification because adding the
  ignored evidence logs changed the index during the hook. HOOK005 correctly
  rejected it. The commit was retried with the complete staged tree.
