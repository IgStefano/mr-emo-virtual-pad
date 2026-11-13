# Architecture and implementation status

Single Electron/React/TypeScript project. Build: Forge + Vite. Runtime data will
use SQLite metadata plus managed audio files; storage is not implemented yet.
Driver choice requires the packaged Electron spike described in research v2.

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
by the future controller. Its stopped result means the transition has requested
cleanup, not that a device is already silent. The future executor must retain its
busy gate until cleanup/lease release is acknowledged. Do not wire this reducer
directly to React buttons as a complete playback controller.

Audio execution, playback/edit leases, SQLite, file import/delete, managed media
protocol and editing UI are not implemented. Use one HTMLAudioElement eligible
to play, controlled outside React; main will arbitrate access to the acervo.
No global bus or event sourcing: asynchronous results return as correlated inputs.

## Runtime shell

One instance, one sandboxed/context-isolated window, Node disabled in renderer,
permissions denied, navigation/new windows blocked, production CSP, ASAR and
release fuses. Bundled CJS preload works in a sandbox. The shell currently loads
local packaged HTML; migrate to a restricted custom protocol when media is added.
Dev CSP allows Vite WebSocket on localhost and a per-server nonce for refresh/styles; packaged headers disallow connections.
No remote content or shell API. Mac window closure exits the application.

## Governance

ESLint strict type-aware preset plus explicit async/exhaustiveness/escape rules,
React hooks/a11y, Vitest rules and a local rule restricting unknown. Deslop-inspired
assertion restrictions are implemented locally; ai-deslop is not installed.
No generic detector claims to prove absence of slop. Symbol-aware restrictions on
future Audio/IPC/storage adapters must be added with those actual adapters.

Tests run the real graph against illegal relative/alias/type/builtin imports and
lint invalid snippets. Mutation includes every domain TS file today, at 100%,
with a nonempty-report gate. Extend the mutation glob to new behavior-bearing
controllers/adapters/contracts alongside their implementation. Current excluded
shell/contracts are wiring, not verified playback or storage.

Exceptions must identify rule, narrow scope, reason, compensating evidence and
review condition. Global suppression/threshold reduction is a policy change,
not a routine fix. Checks cannot prevent their own modification: required CI
and human review of policy changes remain necessary. CI files do not configure
host branch protection automatically.

Enum values are named objects with `as const`; types derive from their values.
Lint rejects native enums, string-literal unions and inline type/status/kind
discriminators; literal values in serialized fixtures remain valid test data.
