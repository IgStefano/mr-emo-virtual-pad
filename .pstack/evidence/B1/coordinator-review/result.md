# Coordinator acceptance checks

Reviewed B1 at 6225b1ba1b00bf85aaeddccea09c8b0c136e9819 and A1 at
8b54d260ebc52aab70231bf1070637889f00a48a. The independent reviewer reproduced
retained subscriber resources through public methods. Its findings and original
probe are preserved here as historical evidence against that B1 snapshot.

Both dispose methods now clear their subscriptions before asynchronous cleanup.
The regression uses node:v8 queryObjects to observe captured resource collection
while both owners remain reachable. It neither reads private fields nor replaces
Set methods. This experimental diagnostic is confined to tests on pinned Node 24.

Observed checks on the corrected combined implementation:

- npm run verify exited 0. All 61 tests passed; 453 mutants were killed, with no
  survivors, uncovered mutants, timeouts or errors. See verify.log and mutation.json.
- Removing both cleanup statements made the regression fail, exit 1: two captured
  resources remained instead of zero. Restoring the exact files made it pass,
  exit 0. See regression-red.log and regression-green.log.
- Coordinator read the storage/library production diff and tests. SQLite foreign
  key enforcement defaults to enabled in the pinned node:sqlite API. CAS updates,
  asynchronous copies and durable deletion cleanup are implemented; process-death
  and fsync hardening remain A2.

This acceptance covers module behavior. Successful managed-media playback,
privileged runtime wiring, packaged target compatibility and physical Mac/interface
acceptance are separate pending gates. No latency or physical output is claimed.
