# Commit and push gates

`npm ci` installs Husky through the prepare lifecycle. The generated hook wrappers
are local; the hook definitions are versioned in `.husky`. Git worktrees resolve
the relative hook path in their own checkout after dependency installation.

Pre-commit rejects unstaged tracked changes and untracked nonignored files. This
makes the files being verified match the commit index. Partial staging is not
supported by this gate. lint-staged formats and restages the staged files, then
the hook runs `npm run verify`, including lint, types, graph, policy fixtures,
pstack validation, tests and mutation. A changed index during verification aborts
the commit. Ignored reports and build artifacts do not enter the commit.

Pre-push requires a clean HEAD and checks that pushed commits resolve to the
checked-out commit. Pushing a different branch requires checking it out first.
The hook runs `npm run package`; failure blocks the push. This gate builds the
local platform artifact, not a substitute for Mac and Windows runtime evidence.

GitHub Actions also runs verification and native packaging. Local hooks can be
bypassed by Git options or environment; they are not a security boundary. Required
branch checks need host-side protection, which is not configured by these files.
Policy-file changes and whether tests express the intended behavior remain review
questions. A passing hook cannot judge those meanings.

AGENTS.md is a context map. Enum syntax, import direction, async rules and UI
primitive placement are enforced in lint/graph configuration. Command execution
belongs to hooks/CI rather than reminders in the agent context. The contract for
real-device evidence remains in verification.md because a hook cannot infer sound
quality or invent missing Mac hardware.

Feature views under `renderer/performance` and `renderer/editing` use the
`feature/views` ESLint rule. TSX renders and binds events; state, asynchronous
work and behavioral control flow live in mutation-covered TypeScript modules.
Guardrail fixtures reject eleven forbidden forms and check that the actual
ESLint configuration enables the rule for both feature directories. Rendering
conditions and shadcn primitives remain supported. React/Radix DOM tests exercise
the extracted behavior through visible controls.

Stryker omits generated `out/` distributions from sandbox copying. macOS bundles
contain directory symlinks that cannot be copied as ordinary source files. This
setting does not exclude production sources from mutation.
