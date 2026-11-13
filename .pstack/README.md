# Parallel delivery with pstack

Upstream pstack 0.15.36 is installed project-locally in
`.agents/skills/pstack`, pinned by commit and per-file hashes in upstream-lock.json.
All 58 skills and their supporting files are versioned, with the MIT license.
The repository uses its real poteto/swarm/principles instructions through the
Codex/T3 adapter, not a simulated Cursor plugin installation.

Read codex-t3.md first. Models are set to small/medium reasoning, inherit-parent.
New turns can discover the installed skills; AGENTS.md also points to their exact
files so operation does not depend on slash-command registration.

## Commands

```sh
npm run pstack:doctor
npm run pstack:ready
npm run pstack:brief -- P0 S1
```

Doctor verifies the upstream inventory/hashes, model mapping, task graph, referenced
briefs/evidence and accepted commits. Ready lists prerequisite-satisfied tasks.
Brief refuses a dirty/unpublished base or conflicting/nonready selection, then
prints PREVIEW_ONLY T3 worktree requests for the coordinator to inspect. None starts an agent.

Before dispatch, one coordinator reserves selected tasks as active, commits and
publishes that manifest, and regenerates requests at the new exact base. The
command accepts active tasks with `npm run pstack:brief -- --reserved P0 S1`; see the adapter for the status protocol.
A worker never writes work.json. Its handoff contains evidence and head SHA for
the integrator to accept, reject or leave blocked. Accepted statuses require
existing evidence and an accepted commit contained in the current base.

P0 and S1 are initially ready. A1/B1/C1 wait for accepted P0. I1 waits for all three;
A2/B2/C2 then parallelize, and R1 waits for these plus actual target-hardware S1.
S1 may prepare scripts now but cannot be accepted without real platform results.
No product task was dispatched during setup.

The project validator has negative tests for dependency cycles, missing
prerequisites, shared writes, capacity and false acceptance. It is not a proof
that evidence is correct. Real runtime verification and final Mac acceptance
remain explicit tasks.

## Upgrade

Use the official skill-installer helper with the selected cursor/plugins commit
and all pstack/skills paths, preserving the upstream layout. Update accompanying
docs/agents/license, inspect the upstream diff and regenerate per-file SHA-256
entries in upstream-lock.json. Validate the adapter/model mappings and rerun the
project checks. Never edit vendored skills to make the hash check pass; keep local
adaptation here. No automatic upstream updates run in workers or CI.

Use `npm run pstack:scope -- TASK BASE_SHA HEAD_SHA` on a worker handoff to
reject committed files outside its owned paths. This does not detect uncommitted
changes or external side effects; review those separately.

When S1 finishes probe preparation but lacks target hardware, record it blocked
with its evidence and free its active worker slot. A1/B1/C1 can then all run after
P0 acceptance. Missing S1 evidence still blocks R1.
