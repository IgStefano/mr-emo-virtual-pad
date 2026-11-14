# R1 worker evidence

Goal: complete offline trial delivery for the drummer before S1 physical acceptance.
Status: ISSUES. Mac x64 ZIP exists; Mac arm64 build and Mac/Windows execution still
require native CI. Remote CI/private artifact retrieval was not available here.
No Developer ID signing/notarization or physical-performance claim is made.

Base is exactly `04551fbfaf4a543b58c6370c7a7434971e0aa1bf` (checked before editing).
Head is the commit containing this evidence; resolve with `git rev-parse HEAD`.
Only workflow and docs/release plus lane-local evidence change. Product source,
lockfile, runtime fuses, checks and mutation policy remain unchanged.
Source tree at base is `67c28214bfd6661d79a1dc3f7a9e1d1c744a70b0`.
Product `src` tree hash is `b7102f200ab11850da693a16ca5cbdc10726aa12`.
Artifact manifest records the dirty documentation/workflow state during build,
not a false claim of a clean published build. Product sources match the base.

Host is WSL2 Linux x64, kernel 6.18.58.1, Node 24.21.0. No benchmark was run.
The native commands below used
`LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu`.
Forge used lane-local `TMPDIR=/tmp/r1-forge`.

Observed commands and exit codes:

- `VITEST_MAX_WORKERS=1 npm run verify`: 0. 208 tests, 1,203 Killed and one
  Timeout across 1,204 mutants; zero Survived/NoCoverage. Timeout mutant 860
  replaces the EOF condition at media-protocol.ts:147 with false, allowing the
  nonterminating zero-byte read. Actual statusReason is hit limit reached.
  Full inventory is mutation.json.gz, classification in mutation-summary.json.
- `npm ci`: 0. Dependencies were absent. Installation reported 11 moderate audit advisories; dependencies were not changed.
- `npm run package`: 0, Linux x64.
- `npm run make -- --platform=darwin --arch=x64`: 0, cross-build only.
- `node docs/release/artifacts.mjs`: 0, actual ZIP hash/bytes in artifacts.json.
- `bash -n docs/release/collect-mac.sh`: 0. Actual macOS script execution NOT RUN.
- `node --check docs/release/artifacts.mjs`: 0.
- `node scripts/verification/journey.mjs`: first exit 1 at app.isPackaged assertion;
  repeated after builds completed, exit 0. First attempt ran concurrently with
  packaging/download and observed true instead of false. Concurrency as cause is
  an inference, not proven. Preserve first-attempt log and passing journey.json.
- `npm run verification:packaged-playback`: 0, Linux native decode/progress/STOP,
  restricted 206 media and catalog seeded by unpackaged picker-boundary control.
  This does not prove packaged native-picker import or physical audio output.
- `npm run verification:drive`: 0, native shell PASS.
- `npm run verification:regressions`: 0, baseline passed and both deliberately
  faulty controller variants rejected. See regressions.json; separate from Stryker.
- `git diff --check`: 0 before staging (repeated after final workflow edit).

The new Mac x64 ASAR was inspected with @electron/asar (exit 0): version 0.1.0,
main/preload entries present, no repository tests/reports/.pstack/.git/.env
content found. See archive.json. This is static evidence only.

The workflow diff was read, including its former shallow checkout and implicit
architectures. Full history now supports acceptedSha ancestry validation. Explicit
macos-15 arm64, macos-15-intel x64, windows-2025 x64 labels were checked against
https://docs.github.com/en/actions/reference/runners/github-hosted-runners on
2026-11-14. This is configuration verification, not observed job success.
Native jobs preserve reports and ZIPs after failures, with SHA-specific names,
30-day retention, version/platform/architecture and checksum manifest. The Mac x64
package path is explicitly supplied to the existing harness (whose Mac default
is arm64). TMPDIR/TEMP/TMP isolate native packaging temporary files.

The Portuguese guide covers architecture, normal security opening, operations,
cleanup retry, closed-app whole-library backup/restore and format limitations.
collect-mac.sh gathers actual metadata/signature assessment without changing
security settings. checklist.md leaves hardware checks NOT RUN and defines raw
physical latency measurement with baseline, method, uncertainty and operator-agreed
thresholds. Test Behavior, Not Implementation guided reuse of native user-visible
journeys instead of tests that mirror YAML or documentation. Technical Writing
guided actionable Portuguese steps and separate recorded limitations.

Remaining delivery steps belong to the coordinator: integrate/publish, run native
matrix with full history, retrieve arm64/x64 Mac and Windows artifacts and reports,
select the actual Mac architecture and deliver ZIP plus docs/checklist. Validate
first-open security flow, actual codecs, physical stereo, start/STOP latency,
hours offline, close/suspend/unplug/restart and intact originals in S1. Existing
coordinator evidence remains historical and was not overwritten. No physical
operator work is requested before the complete target candidate is available.
