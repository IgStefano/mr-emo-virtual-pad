# A1 repair design and integration notes

Base is 5525193683d3935e2bd87fcaee35401e350d0209.
Input SHA-256 matched c7ff9baf01599705cba8335bab3d35b99509e0c73c27360c371b46480140d6c6 before restoration.
The original repair-input worktree was not modified.

CatalogStore uses normalized catalog, assets, pads and cleanup tables. Pads carry
unique nonnegative positions, foreign keys, and label/color checks. Publication
compares the previous revision inside BEGIN IMMEDIATE. File copies and validation
run outside transactions. ManagedFiles owns disk operations. ManagedCatalog owns
use cases, edit authorization and busy coordination. Empty selections return the
unchanged catalog. Unknown staging/media entries move into UUID-named quarantine;
symlinks are moved themselves. Missing or symlinked referenced media fails recovery.

No shared edits are currently required. Existing Vitest discovery and Stryker scope
already include both owned production directories and tests/storage. Bootstrap,
IPC, media protocol and production validator wiring remain integrator work.
No driver or dependency was substituted. This is host Node SQLite evidence;
packaging the existing shell does not exercise storage inside Electron.

A2 must exercise process death between copy, promotion, SQL commit and cleanup
acknowledgment, filesystem durability/fsync, and hostile concurrent directory
replacement. Physical Mac/interface acceptance remains at the complete candidate.
No latency or throughput measurement was made. Physical audio performance is not
applicable to this unconnected catalog implementation.

The Node 24 SQLite options declaration records foreign-key enforcement as enabled
by default. Constraint tests exercise that default. Migration failure closes the
connection, which rolls its transaction back. There is no duplicated inner
rollback handler. Linux-only descriptor inspection tests initialization resource
release; that single host-specific test is skipped on other platforms.
