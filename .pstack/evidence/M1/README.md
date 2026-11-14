# M1 local protocol evidence

Base verified before editing at e7d10898e94b857470ab34b5241cb9e18723932f.

Owned implementation exports ManagedMediaProtocol and ApplicationProtocol using
web Request/Response objects. No Electron imports or scheme registration are added.
Media requests validate asset and lease UUIDs before authorization and filesystem
access. Reads use a file descriptor and at most 65536 bytes per pull, including
ranges from a sparse 4 GiB track. O_NOFOLLOW rejects managed-file symlinks.
The request registry includes pending authorization and opening, so cancellation
is checked after each asynchronous boundary. Bodies report real read failures.
Application requests resolve bundled files within the renderer root and return
MIME and a CSP forbidding network connections.

Tests use real temporary files. Delayed-open tests wrap only the opening boundary
and return a real descriptor, then prove it is closed through its public stat
operation. Authorization delay tests exercise revoke, dispose and request abort.
No private implementation fields are inspected.

Acceptance results are recorded below.
Bootstrap registration, service composition, Electron playback, packaged behavior
and physical audio remain integration work outside this module.

The first full verify invocation exited 1 at the mutation gate with 92.52%.
The report covered both adapters. Missing range, URL and lifecycle observations
were added. The pending registry was simplified from a map of sets to one set of
lease/controller records. Redundant numeric checks were removed because the
validated range grammar and file-size clamps already bound the selected offsets.
The second full verification exited 1 at 98.41%. Further lifecycle observations
and removal of redundant checks resolved the remaining survivors.

npm ci exited 0. Focused media tests pass 78 tests, including the existing
metadata tests. Focused ESLint and full TypeScript checks exited 0. Full verify's
static, unit and mutation output is retained in verify-second.log.


The third `npm run verify` exited 0. It ran static checks, all unit tests and the
unchanged 100% mutation gate, including both new protocol adapters. The per-file
counts are in mutation-summary.json. The complete local run is verify-third.log.
No mutants were suppressed and no shared checks or contracts were edited.
The normal commit hook reruns verification; a successfully created commit records
that gate passing for the staged tree. No hardware evidence is claimed.

Type System Discipline shaped the boundary parsing choice. Asset and lease values
are parsed by the frozen branded schemas before authorization.
