# Working in this repository

Read [the V1 specification](docs/spec.md) before changing behavior. Read
[architecture](docs/architecture.md) before adding a module, dependency, effect,
IPC method or persistence operation.

Use `npm run verify` before completing changes. For Electron wiring or build
changes, also run `npm run package`. Commands and prerequisites are in README.
Report actual commands/results and platform limitations.

Represent enums as named objects with `as const` and derive types from their
values. Use named members for discriminators and comparisons; lint enforces this
for string unions, native enums and inline type/status/kind discriminators.

Follow the approved operations: UI sends intentions to playback; main owns
privileged operations; adapters own effects; contracts validate runtime ingress.
Extend guardrail fixtures when adding a restriction. Keep mutation scope aligned
with new production logic; justify any exception locally and explicitly.

Changes to checks, mutation scope, thresholds or exceptions require an explanation
of their effect on verification. Preserve the checks while fixing the code.

For runtime verification and evidence, follow [verification](docs/verification.md).
Research notes are decision history; docs/architecture.md describes the current
implementation and its remaining work.
