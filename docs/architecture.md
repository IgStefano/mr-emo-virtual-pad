# Architecture and implementation status

Single Electron/React/TypeScript project. Build: Forge + Vite. Storage uses
node:sqlite metadata plus managed audio files. The storage and playback modules
pass host verification; packaged target compatibility remains a release gate.

## Layer matrix

| Origin    | Local dependencies          |
| --------- | --------------------------- |
| domain    | domain                      |
| contracts | contracts                   |
| main      | main, domain, contracts     |
| preload   | preload, contracts          |
| renderer  | renderer, domain, contracts |

Domain has no ambient clock, randomness, I/O or external packages. Contracts may
use Zod. Preload exposes named operations; renderer has no Node/Electron access.
The resolved graph includes type imports and aliases. New production directories
must belong to the matrix. dependency-cruiser owns graph checks; ESLint owns
syntax, types, asynchronous usage and environment restrictions.

Unknown data is confined to ingress/validation and error normalization; domain
and renderer contracts are closed types. Zod validates the app-info IPC response.
Main authorizes exact sender/frame/URL. Adding IPC requires runtime validation of
inputs and outputs as well as authorization; TS types alone are insufficient.

## First executable behavior

`domain/playback.ts` is a pure transition function returning state and effects.
It enforces single-attempt transitions, ignores busy clicks and stale callbacks,
and emits start-at-zero/stop intentions. Attempt IDs must be unique and allocated
by PlaybackController. Its stopped result means the transition has requested
cleanup, not that a device is already silent. The controller retains its
busy gate until cleanup/lease release is acknowledged. Do not wire this reducer
directly to React buttons as a complete playback controller.

ManagedCatalog coordinates import, revision checks, edits and deletion through
CatalogStore and ManagedFiles. PlaybackController owns playback attempts and
cleanup; DomAudioExecutor owns the single eligible HTMLAudioElement outside React.
Main lease arbitration and finite IPC/media composition are wired in bootstrap. The polished editing UI remains B2 work.
No global bus or event sourcing: asynchronous results return as correlated inputs.

## Runtime shell

One instance, one sandboxed/context-isolated window, Node disabled in renderer,
permissions denied, navigation/new windows blocked, production CSP, ASAR and
release fuses. Bundled CJS preload works in a sandbox. The built shell loads local HTML through pad-app; pad-media serves managed assets under playback authority.
Dev CSP allows Vite WebSocket on localhost and a per-server nonce for refresh/styles; packaged headers disallow connections.
No remote content or shell API. Mac window closure exits the application.

## Governance

ESLint strict type-aware preset plus explicit async/exhaustiveness/escape rules,
React hooks/a11y, Vitest rules and a local rule restricting unknown. Deslop-inspired
assertion restrictions are implemented locally; ai-deslop is not installed.
No generic detector claims to prove absence of slop. Symbol-aware restrictions on
future Audio/IPC/storage adapters must be added with those actual adapters.

Tests run the real graph against illegal relative/alias/type/builtin imports and
lint invalid snippets. Mutation covers domain, catalog/operation contracts,
storage/library and playback modules at 100%,
with a nonempty-report gate. Extend the mutation glob to new behavior-bearing
controllers/adapters/contracts alongside their implementation. Current excluded
shell/app-info files are wiring, not verified end-to-end playback or storage.

Exceptions must identify rule, narrow scope, reason, compensating evidence and
review condition. Global suppression/threshold reduction is a policy change,
not a routine fix. Checks cannot prevent their own modification: required CI
and human review of policy changes remain necessary. CI files do not configure
host branch protection automatically.

Enum values are named objects with `as const`; types derive from their values.
Lint rejects native enums, string-literal unions and inline type/status/kind
discriminators; literal values in serialized fixtures remain valid test data.

## I1 authority foundation

`main/ipc/authority.ts` reserves a recovery lease before returning a new session.
Concurrent opens and reservations fail while recovery runs. Recovery failure
revokes the session; recovery cannot be interrupted by closing the session.
Reservations check session identity synchronously and release checks all lease
fields. Callers must terminate renderer audio before closing a playback session.
Bootstrap owns the authority, catalog, service and restricted protocols. It captures successful open responses in main and drains pending responses after renderer destruction before closing the owned session. Recovery completes before open returns.

The storage boundary now provides `storage/audio-metadata.ts`, using
music-metadata to inspect an extensionless copied staging file and reject absent,
nonfinite or nonpositive durations. Parser failures become UnsupportedFormat
faults. This adapter is tested with real PCM stereo bytes and invalid metadata,
and bootstrap supplies it to ManagedCatalog. The unpackaged Linux journey additionally proves native PCM decode and progress through pad-media, without claiming physical output or target codec compatibility.

## I1 composition

The finite preload API is adapted in renderer/runtime/desktop.ts. PlaybackController
and DomAudioExecutor remain the playback and native audio owners, instantiated
outside React. Edit reservations precede the native file dialog; revisioned
mutations release authority even on failure. React subscribes to controller state.
Bootstrap registers secure standard schemes before readiness and installs the
accepted protocol handlers afterward. Both HTML and response CSP permit only the
restricted media scheme. Renderer destruction drains pending opens and privileged
work using main-captured identity; no renderer recovery capability is exposed.

The executable unpackaged journey is scripts/verification/journey.mjs. It asserts
the disposable profile, removes the original after byte comparison, restarts,
observes native progress and a 206 media response, stops and deletes the copy.
Release packaging retains the existing fuses; this journey does not inspect the
fused package or prove physical output.
