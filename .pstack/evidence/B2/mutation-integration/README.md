# B2 behavioral mutation integration

Required base: `f33af795cdbadda96230a873e8583e43161a3700`.
The provisioned checkout was clean at this exact SHA. The supplied recovery
script restored seven files, verifying the clean base and each SHA256. No other
checkout was created or modified. `recovery-manifest.json` preserves the source
workspace and hashes, without duplicating the snapshot's base64 payloads.
The predecessor work was unfinished: its DOM fixtures failed current catalog
validation and its refactors failed lint/typecheck. These were repaired here.

## Separation

`performance/use-pad.ts` owns drafts, asynchronous save sequencing, authoritative
catalog publication, editing transitions, gesture commands and focus targets.
Deletion stores an intent ID; the visible authoritative catalog determines
whether the confirmation still exists, including partial commits. `editor-actions.ts`
normalizes explicit rename/color commands. Feature TSX renders and binds events.
Both new modules are included by the existing mutation globs; shared mutation,
Vitest and ESLint configurations are unchanged. No playback state was recreated.

`tests/ui/editing.test.ts` uses its own jsdom directive and mounts actual React
and Radix views. Storage replies/failures, pending writes and media methods are
controlled ports. These tests establish behavioral oracles, not native audio
acceptance. The existing integration test and recovery probe use real temporary
SQLite and managed copies, with controlled unlink/metadata ports. The native
Electron journeys use the actual bridge, SQLite and native media; injected file
selection is explicitly controlled. Physical sound/latency is not inferred.

Musician-facing errors now describe retry/reopen recovery in Portuguese without
interpolating service codes. Adapter diagnostics retain their finite codes.
The cleanup warning persists through subsequent successful saves. Failed drafts
remain available for retry, and committed deletions immediately leave the grid.

## Shared proposal

`shared-governance.patch` is **not applied**. It adds the feature-view ESLint rule
and a Node negative-fixture test to the coordinator-owned files. It scopes the
rule to performance/editing TSX and exempts shadcn primitives. It rejects async
functions/await, promise chains, imperative branching/loops, mutation, React
state/effect imports (including aliases), and conditions inside event callbacks.
Normal JSX conditions, attributes, mapping and direct event binding remain valid.
Diagnostics name the fix: move behavior into mutation-covered `.ts` modules.
Bootstrap `main.tsx` remains outside the feature rule.

Reproduce the isolated acceptance and regenerate the exact shared patch:

```sh
python3 .pstack/evidence/B2/mutation-integration/make-patch.py
node .pstack/evidence/B2/mutation-integration/check-boundary.mjs
git apply --check .pstack/evidence/B2/mutation-integration/shared-governance.patch
```

After coordinator application, run `npm run lint` and `npm run test:guardrails`.
Eleven negative fixtures and current feature views pass isolated acceptance.
No mechanical instructions were added to AGENTS.md.

## Verification and limits

Commands, actual exits, mutation inventory and source Git blob IDs are recorded
alongside this file. The compressed Stryker report includes every mutant's
location, replacement and status. `inventory.py` refuses stale source reports.
The implementation commit contains these exact source blobs; its full commit
SHA is returned in the handoff rather than embedded in its own content.

Dependencies were restored with `npm ci`; registry package metadata was checked
for the exact jsdom and Testing Library versions (included JSON artifacts).
The package test typecheck enables React JSX for view imports without modifying
shared test configuration. New dependencies are development-only.

Native host runs require:

```sh
export LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu
node .pstack/evidence/B2/repair/recovery.mjs
node .pstack/evidence/B2/repair/native-flows.mjs
node .pstack/evidence/B2/repair/journey.mjs
PAD_CHROMIUM_EXECUTABLE=/home/igstefano/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell node .pstack/evidence/B2/repair/drafts-focus.mjs
VITEST_MAX_WORKERS=1 npm run verify
TMPDIR=$PWD/reports/b2-mutation/tmp npm run package
```

Create `reports/b2-repair` and the lane-local package TMPDIR before the probes.
The first recovery attempt failed because the report directory was absent; the
rerun passed after creating it. Earlier lint/typecheck failures and failed
mutation attempts are retained in `attempt-logs.tar.gz`, without threshold or deadline changes.
Superseded mutation runs are labeled interrupted, never counted as passes.

No Mac/physical audio interface, physical latency, Windows or packaged functional
acceptance is claimed. Packaging is a Linux build check. These genuine platform
checks remain at complete-candidate/coordinator acceptance. There was no nested
delegation, publication, or human code-approval wait.

## Complete candidate results

`VITEST_MAX_WORKERS=1 npm run verify` exited **0**: 208 tests passed;
1,204 mutants, 1,203 killed and one detected by timeout. There are no surviving,
uncovered, ignored or invalid mutants. `use-pad.ts` has 122 killed mutants;
`editor-actions.ts` has 11 killed mutants. The full inventory is `inventory.json`
and `mutation.json.gz`; the complete gate log is `verify-final.log.gz`.

Packaging and all four repaired probes exited **0** against this candidate.
The final full-scope failure (two survivors) was resolved by waiting for the
no-source drop to settle and asserting no error. Its targeted line rerun killed
all five mutants, followed by the complete passing default-scope run above.
No threshold, suppression, exclusion, deadline or shared configuration changed.

The normal commit hook reruns full verification against the staged tree before
creating the handoff commit. Its actual exit and commit SHA are reported in the
handoff, with the local `reports/b2-mutation/commit.log` output. This avoids
claiming a commit's own future hook result inside its staged contents.
