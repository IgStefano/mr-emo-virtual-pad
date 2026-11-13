# P0 evidence

PASS for the pure contract slice. Base `715512da99a1abc069e6bfaf2d7874e0053a088d`.
The containing commit is the handoff head.

Observed commands and exit codes:

- Initial `npm run verify` exited 127 because dependencies were absent.
- `npm ci` exited 0. The lockfile and dependency versions are unchanged.
- `npm run verify` exited 0. All static, architecture, guardrail, pstack and hook
  checks passed. Vitest passed 20 tests in three files. Stryker killed 81/81
  mutants, with zero timeouts, survivors, uncovered mutants or errors.
- Commit hook runs the required final verification after adding this evidence,
  the inferred RepertoireId export and DOM test type libraries. Its output is
  reported in the handoff rather than recursively committing its own log.

`verify.log` contains the complete successful verification output. `mutation.json`
is the corresponding machine-readable mutation inventory. `npm-ci.log` records
installation. Runtime schemas account for 16 killed mutants; the lease gate for
24; existing playback for 41. No ignore/exclusion/threshold reduction was added.
Future lane mutation globs currently warn that those directories do not exist.

Fixtures reject invalid IDs, numbers, colors, unknown fields, wrong edit lease
kinds and future schema versions. The reservation gate rejects competing owners
until matching stop cleanup acknowledgement, including stale-session and
wrong-lease callbacks. These are pure contract observations. Sender/frame/URL
checks, active audio resources and actual IPC are integrator runtime obligations,
not a P0 runtime security verdict.

Changed paths are the two new contract modules, domain lease module, two contract
test files, TypeScript/Vitest/Stryker discovery configuration and P0 evidence.
`contracts.md` freezes exported interfaces and consumer obligations.

No Electron wiring changed, so package/smoke was not run for this slice. Physical
latency and codec measurements do not apply to pure contracts. Real Mac/Windows,
SQLite, audio cleanup and packaged runtime results remain explicit gaps for the
runtime lanes. No PR, publication or merge was performed.
