# P0 coordinator review

Reviewed 715512da99a1abc069e6bfaf2d7874e0053a088d through
7d94c55378f90cb917b1f21ff8b77210a722e3ec. Owned-path check passed and the
committed contracts, state transitions and tests were read. Integrated as
ce59908. Catalog shape validation deliberately does not authorize a caller or
replace storage referential integrity; these obligations remain I1/A1.

The coordinator keeps actual Electron journeys outside the Node/Vitest mutation
runner. Their TypeScript discovery remains available, but live tests have a
separate execution surface. S1 standalone SQLite diagnostics now run in static
verification. Playback mutation extends to the new schemas/reservation behavior.

Playwright is provisioned for C1. Bootstrap honors an existing absolute
PAD_VERIFICATION_DATA_DIR before the single-instance lock, permitting disposable
profiles. The harness must create that directory and verify the effective path.
Release inspection fuses stay enabled as security restrictions; an unfused dev
runtime smoke is not a claim that packaged release automation passed.
