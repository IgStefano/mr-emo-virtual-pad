# J1 concurrency repair

Required dependent base is `415f823df8400dc2e5b5383dc4194ab30a692c7e`.
M1 is unchanged. No publication or main merge is authorized.

The pending set drains all work. A separate exclusive flag reserves edit, recovery
and release effects synchronously. Reads coexist. Release bypasses pending reads
but cannot bypass an exclusive effect. Acquisition and normal disposal still
refuse pending work. Media authorization remains tracked through membership and
public authority validation, so termination drains the whole authorization.

The Type System Discipline principle kept the existing schema-derived lease and
branded IDs intact. No DTO or preload API changed.

`review/` preserves the independent findings and original reproduction unchanged.
The original script has a `.txt` suffix to preserve its bytes without linting it
as active project code. `probe.cjs` targets this checkout via `process.cwd()` and
asserts the corrected concurrent, read/release and stale-lease outcomes. Its final
two observations retain the review's pending-open integration context.

Tests use public methods, real temporary SQLite catalogs, copied WAV bytes and
controlled asynchronous ports. Physical audio output and performance are not
measured. I1 must compose bootstrap, capture main-side session identity even if
renderer receipt is lost, wire protocols and native dialog/metadata, and prove the
real import/playback/progress/STOP/delete/restart journey. Packaged compatibility
and Mac/interface/codec acceptance remain deferred to the complete candidate.

Full verification passed with 161 tests and 913 mutants. The final inventory is
912 Killed and 1 Timeout, with no survivors, uncovered, invalid or ignored mutants.
The timeout is in unchanged M1 media protocol code; it is detected by timeout,
not represented as a killed mutant. Detailed locations and statuses are retained
in `mutation-final.json`; the failed first inventory is `mutation-first.json`.
No shared edits or policy exceptions were required.
