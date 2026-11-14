# A1 repair result

PASS for the owned implementation scope, subject to the normal commit hook.

Base SHA is 5525193683d3935e2bd87fcaee35401e350d0209. The resulting commit is
reported by the worker handoff. No merge, publication or shared configuration edit
was performed. The coordinator still owns independent review and integration.

Changed production paths are src/main/library/managed-catalog.ts,
src/main/storage/catalog-store.ts and src/main/storage/managed-files.ts.
Tests are in tests/storage/catalog.test.ts. Evidence is in this directory.
The actual staged production diff and test changes were read during this repair;
this is an implementation check, not an independent code review.

Observed real SQLite/temp-disk behavior includes restart with 31 pads, label/color
and order persistence, unchanged cancelled selection, atomic stale-revision
rejection, relational rollback, shared-asset preservation, missing/corrupt/future
catalog detection without reset, asynchronous copy/validation/promotion failures,
durable unlink retry, quarantine preserving unknown bytes and symlink targets,
busy/revoked coordination, and resource release after failed initialization.

Commands and observed exit codes:

- npm ci: 0. Dependencies were absent initially.
- Initial npm run verify before installation: 127, missing prettier.
- First post-install verify attempts: 1 for lint errors, corrected.
- First completed mutation gate via npm run verify: 1, 271 killed / 35 survived / 11 uncovered, 85.49%.
- Second completed mutation gate via npm run verify: 1, 304 killed / 11 survived / 0 uncovered, 96.51%.
- Final npm run verify: 0. Static, architecture, guardrails, runtime, harness,
  48 unit tests and mutation checks passed.
- Final mutation: 310 killed / 0 survived / 0 uncovered / 0 timeout, 100%.
  The A1 production files account for 229 killed mutants.
- npm run package: 0, Linux x64 shell packaging.
- npm run pstack:ready: 0, empty ready queue.
- git diff --cached --check: 0.

A commit attempt was stopped with exit 130 to correct the initial mutation counts
in this evidence before committing. An accidental duplicate standalone mutation
invocation was also stopped with exit 130;
its report was not used. The completed runs above are the evidence.

Artifacts include mutation-initial.json, mutation-second.json, mutation-final.json,
verify-initial.txt, verify-second.txt, verify-final.txt, npm-ci.txt and package.txt.
No thresholds or exclusions changed. Existing discovery/mutation scope was already
sufficient, so there is no required shared patch.

Remaining gaps are explicit in notes.md. This shell package does not wire or
exercise the catalog inside Electron. Integration remains I1. Process-death/fsync
and hostile directory-replacement hardening remain A2. Physical Mac/interface
acceptance is still required after the complete candidate. No performance numbers
were measured or inferred.
