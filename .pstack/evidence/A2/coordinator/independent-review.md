# A2 independent review: ISSUES

Goal: verify the drummer pad's A2 lifecycle/recovery snapshot without modifying the worker.
Target: /home/igstefano/.t3/worktrees/mr-emo-virtual-pad/t3-ef1b4217-463309675204ff70
Base: 806a3fbaf8b3f178ae47724afa4d3fbcccdafa12
HEAD: 192e2aebabb6d6bff33455f57a11c6aa88f21f06
HEAD and tracked cleanliness verified before and after execution. No target source/tests/config/dependencies or tracked evidence changed.

## P2: bootstrap retains rejected cleanup forever

src/main/main.ts:61 returns the same shutdown promise assigned once at lines 146–148. If terminate rejects, ApplicationShutdown correctly resets its pending flag, but another quit calls drain against the same rejected promise. It never invokes terminate again. RendererLifetime's retry support is therefore unreachable from application quit. The window has already been destroyed, leaving a windowless process that reports errors on every quit; media.dispose/catalog.close after the rejected await have not run.

Executable public-port reproduction: from this review checkout run:
`node --experimental-transform-types reports/a2-review/retry.mjs`
Exit 0 confirms the defect: after the cleanup dependency recovers, two quit requests result in attempts=1, quits=0, reports=2. Direct lifetime retry then succeeds and raises attempts to 2. This reproduces main's one-shot assignment and drain closure through real RendererLifetime and ApplicationShutdown; it does not inject a native filesystem failure. Expected behavior is another cleanup attempt and eventual quit after transient failure. Existing tests independently retry each class but do not compose the bootstrap closure.

## Executed verification

In target: `VITEST_MAX_WORKERS=1 npm test -- tests/ipc/renderer-lifetime.test.ts tests/lifecycle tests/storage/catalog.test.ts`
Exit 0; 48 tests in 5 files passed. Includes actual child SIGKILL at staging, promotion, commit, deletion and unlink; two reopens check catalog counts, managed bytes, original bytes and quarantine. Permission denial and open-handle deletion were executed on Linux. These are real crash handoffs, not physical power/fsync durability proof.

In target: `LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu node /home/igstefano/.t3/worktrees/mr-emo-virtual-pad/t3-34615fbe-142874289396169b/reports/a2-review/runtime.mjs`
Exit 0. Scratch copy changes only dependency/fixture import locations and evidence output directory. Electron launches the target cwd with isolated temporary profile and unchanged sandbox settings. runtime.json and native.log record pending native dialog import drain, cancel close, synthetic suspend exit, confirmed close and stopped restarts. This is original A2 scaffold evidence, not combined B2/C2 acceptance. No package installation or rebuild needed.

Inspection: pending open/import draining, renderer destruction, repeated quit/close cancellation and service session serialization were read. No additional proven defect found. No nested agents or UI repair review.

## Mutation classification

Inspected target reports/mutation/mutation.json, not rerun mutation. Author result is 1024 Killed / 3 Timeout (1027 total), not 1027 assertion kills.
455, shutdown.ts:16, replaces pending condition with false: hit limit 601/600.
457, shutdown.ts:17, replaces pending=true with false: hit limit 401/400.
Both remove reentrancy protection; the closeWindows test port calls request recursively. Actual mutant/source/test explain deterministic recursive reentry and hit-limit detection rather than slow hardware. Additional mutation execution unnecessary to classify report diagnostics. Inherited 856, media-protocol.ts:147, removes EOF guard: hit limit 1501/1500; agrees with known M1 EOF loop evidence. No thresholds changed.

## Limits and review principles

Test Behavior, Not Implementation shaped byte/restart assertions and the public-port reproduction. Type System Discipline kept review on reachable typed operations rather than imaginary invalid callers. Read poteto-mode reference and project adapter; user prohibition on nested agents controls this independent review.
Mac/Windows native sequencing and filesystem semantics remain unexecuted inferences. No physical power, device, output, target-platform pass or performance claim. English dialog copy is a minor localization cleanup, not this functional finding.
