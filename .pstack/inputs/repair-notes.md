# A1 and B1 repair inputs

Original staged implementations did not pass the mutation gate and were not
committed or integrated. Their source/tests are preserved as binary-safe Git
patches with SHA-256 metadata. Their original worktrees remain untouched.
Apply only the assigned patch in the new tool-provided worktree. Base/head in
old reports describe the failed prototype, not this new repair run.

A1 requires representation review as well as tests: the prototype persists a
whole catalog JSON blob in SQLite, increments revision on an empty selection,
performs long synchronous copies, deletes unknown orphan files and leaves many
failure paths untested. Prefer normalized tables with constraints and atomic
expected-revision checks. Preserve originals; quarantine unknown files instead
of deleting indiscriminately. Nothing from this unshipped prototype requires a
legacy compatibility layer. Process-death hardening remains an explicit A2
obligation if not completed here.

B1 has missing lifecycle/failure coverage and untested native element creation.
Review failed release/retry, disposal with held resources, observer exceptions,
late callbacks, progress and stale attempts. A fulfilled disposal must not silently
leave resources held. Avoid spelling-only tests for incidental diagnostics;
use the domain error vocabulary and simplify redundant logic when appropriate.
The real Linux Electron shell now passes with the user-local GTK/epoxy library
cache; missing GTK is no longer an unavoidable blocker in this environment.

Both repairs preserve the frozen P0 contracts, owned paths, checks and thresholds.
Run the reports as diagnostic evidence, not as proof of correctness. Every new
assertion must detect an observable product failure. No broad exclusion, lowering
threshold, bypassing hooks or claiming a package smoke proves physical audio.
