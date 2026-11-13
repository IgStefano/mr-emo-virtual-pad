# S1 evidence

Status BLOCKED for target compatibility. Probe preparation and host SQLite pass.
Base 715512da99a1abc069e6bfaf2d7874e0053a088d. Head is the commit containing this
file. Only S1-owned paths changed. No production wiring or dependency edits.

Observed host is Linux x64 under WSL2, Node 24.21.0, SQLite 3.53.4.
`host-sqlite.json` contains actual runtime versions and completed checks.
`runtime-tests.txt` contains the standalone Node test result (1 passed).

Commands executed:

- `npm ci` exited 0. Audit reported 11 moderate vulnerabilities; no lockfile edits.
- `node scripts/probes/sqlite.mjs` exited 0.
- `node --test tests/runtime/*.test.mjs` exited 0.
- `npx prettier --write scripts/probes tests/runtime docs/runtime-probes.md` exited 0.
- Initial `npm run verify` exited 1 on six undefined browser globals in the probe.
  Corrected to globalThis access without changing shared lint policy.

`npm run verify` rerun exited 0. Domain mutation killed 41/41 with zero
survivors, NoCoverage, errors or timeouts. See verify.txt and generated
reports/mutation/mutation.json and mutation.html (untracked build artifacts). Packaging is not invoked because
this slice does not modify Electron wiring. Packaged target execution is BLOCKED.
No audio measurements were made. Mac/interface, band files, agreed limits,
packaged Windows/Mac runtime, managed-media handler and C1 harness are absent.
The probe does not accept a SQLite driver for A1 or establish show readiness.

Standalone MJS diagnostics are outside current mutation/discovery scope. No S1
mutation score is claimed. Existing domain mutation results belong to verify.
The behavior-testing principle shaped SQLite assertions against reopened rows,
constraints and schema rather than internal call order.
