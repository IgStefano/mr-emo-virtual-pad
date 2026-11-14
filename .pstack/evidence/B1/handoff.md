# B1 repair evidence

Base is `5525193683d3935e2bd87fcaee35401e350d0209`. The original checkout was not changed. The input patch SHA-256 matched `0ed67a792131b6791088bf93d368b47dd0d46f1b87ec23cefc6364aa3956a6eb` before application.

## Behavior

The controller reserves synchronously, invalidates before awaiting cleanup, uses unique attempt IDs and ignores busy pad clicks and stale callbacks. STOP retains the busy gate until both audio cleanup and lease release acknowledge completion. Failed stop or release retains ownership for retry. Disposal rejects with the domain cleanup-required code if resources remain held. A fulfilled disposal releases audio and session ownership. Observer exceptions remove the failing observer without preventing other observers or cleanup.

Controlled tests inspect active audio ownership, held leases, external lease requests, progress snapshots and released element sources. They cover pending start disposal, late grant cancellation, release/stop failure and retry, A to B ignored, A to STOP to B from zero, natural end, audio failure, stale callbacks, unsubscribe and observer failure. Adapter tests track registered event resources and invoke retained callbacks after teardown. Default factory tests exercise document element creation. Native Electron evidence additionally uses the real HTMLAudioElement factory and observes pause/source release following rejected media.

Redundant listener clearing on permanently disposed objects was removed. These objects cannot emit after disposal. Explicit unsubscribe remains available to subscribers. Redundant rejection handlers that changed failure state were simplified because STOP already captures failures and records ownership. No mutation exclusions or thresholds changed. Existing integrator-owned discovery and mutation globs already cover these paths, so no shared patch is needed.

## Commands

- `npm ci` exited 0. Dependencies were absent initially.
- `npm run verify` first exited 1 at lint on floating promises. The next run exited 1 on missing browser globals in the isolated evidence script. Both were corrected without changing checks.
- First standalone `npm run test:mutation` exited 1 with 203 killed, 1 timeout, 14 survived, 0 uncovered. It improved the prior 182 killed, 29 survived, 6 uncovered repair input.
- Third `npm run verify` exited 1 with 217 killed, 1 survived, 0 uncovered. Its remaining audio-failure mutant exposed a masking explicit STOP in a test. The test now waits for autonomous cleanup.
- `npm test` exited 0 with 32 tests before the final mutation run.
- `npm run package` exited 0 on Linux x64.
- `npm run verification:drive` with the documented user-local LD_LIBRARY_PATH exited 0. Its existing C1 shell journey retained sandbox, context isolation, CSP and release fuse policy.
- `node .pstack/evidence/B1/native-adapter.mjs` with that same LD_LIBRARY_PATH exited 0. The native element was paused and source-free after stop/disposal. This isolated rejected-media check is not a successful media protocol or output test.
- `npm run pstack:ready` exited 0. Doctor also runs within verification.

Final verify, hook outcome and mutation artifacts are recorded alongside this document and in the coordinator handoff.

## Remaining gates

Managed-media protocol wiring, successful playback of representative formats and complete product integration belong to later slices. This Linux unpackaged shell and rejected-media native probe do not establish packaged Mac behavior. Physical start/STOP acceptance still requires the drummer's Mac and interface at the complete candidate. No performance measurement was made. Pure lifecycle contracts have no physical-output metric or baseline here.

Changes are limited to `src/renderer/playback`, `tests/playback` and `.pstack/evidence/B1`. No publication, merge, shared configuration change or nested delegation occurred. Coordinator review and integration remain required.

## Final verification

`npm run verify` exited 0 on the repaired source. All 32 tests passed. Mutation produced 222 killed, zero survived, zero uncovered, zero timeout and zero errors at the unchanged 100% threshold. `mutation-final.json` and `mutation-final.html` preserve the actual report. The source includes observer isolation in both controller and adapter.

An initial `npm run pstack:scope -- B1` invocation exited 1 because exact base/head arguments were missing. The corrected scope invocation must use the committed head.
