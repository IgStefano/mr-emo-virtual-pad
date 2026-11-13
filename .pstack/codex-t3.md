# pstack adapter for Codex in T3 Code

Read this before upstream skills. The upstream copy is unmodified and pinned in
upstream-lock.json. Its Cursor-specific instructions need the mappings below;
session/system/user instructions take precedence. This is a repository adapter,
not an assertion that Cursor plugins or Cursor-only commands are installed in T3.

## Models and budget

models.json is the role source of truth for this project, in place of
~/.cursor/rules/pstack-models.mdc. The operator chose small, medium reasoning.
Every role inherits the current model. The three exploration panel roles have two
inherited entries; they are independent same-model runs, not diverse-model review.
The arena cross-judge pool has no different-family candidate; report that gap and
use a fresh same-model review only when the user accepts that substitution.
Do not select Grok or Claude defaults or silently switch provider.

For this Codex/T3 session, the dispatch request maps the selected budget to
`target.options.reasoningEffort: medium`; provider/model are omitted. Revalidate
option availability if the provider changes. The native synchronous route follows
session rules when no worktree or extra settings are required.

## Execution mapping

| Upstream term           | This environment                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Task, cloud worker      | T3 delegate_task, isolation worktree, async                                                     |
| poteto-agent type       | Read upstream agents/poteto-agent.md and the local adapter; no nonexistent type field           |
| cloud_base_branch       | Tool-provisioned base; exact committed SHA in brief; do not create/check out worktrees in shell |
| Open todolist           | update_plan                                                                                     |
| Run /skill              | Read the installed SKILL.md via its actual path; no assumed slash-command registration          |
| setup-pstack model rule | .pstack/models.json, loaded through this AGENTS pointer                                         |
| .cursor/skills          | .agents/skills/pstack/skills, preserved upstream layout                                         |
| Fresh reviewer          | New delegation with brief, findings and objections; not messaging a completed worker            |
| Await worker            | Follow delegate_task next; async completion wakes coordinator, no polling                       |
| PR publication/watch    | Session T3 linking/watch rules; children do not monitor PRs                                     |
| Secrets                 | request_secret, never chat or a token in a brief                                                |

The coordinator owns the playbook, contracts and final integration. Workers own
only assigned paths, return PASS/ISSUES/BLOCKED with evidence and do not fan out.
No nested implementation delegation for the initial three-lane partition.
Always read the actual diff before accepting a worker; terminal success is not an
independent review. Do not merge merely because peers agree.

## Throughput checkpoint

- Blocking first steps. P0 freezes contracts and prepares discovery/check scopes.
- Independent workstreams. A1 storage, B1 playback and C1 harness get separate
  tool-created worktrees and owned paths after P0 acceptance.
- Shared mutable state. Contracts, package/lockfile, checks and bootstrap remain
  integrator-owned. Workers propose changes instead of writing competing copies.
- Smallest safe decomposition. At most three workers plus coordinator. Initial
  setup remains serialized; do not launch product work just to prove fan-out.

## Plan and evidence

work.json is the dispatch graph; docs/delivery-plan.md contains detailed acceptance
scenarios. Status changes are integrator-only. Accepted work requires an actual
commit and existing evidence. Report PASS only for verified scope; unavailable
Mac/GTK/codec output stays BLOCKED and cannot satisfy release R1.

Run npm run pstack:doctor and npm run pstack:ready. To prepare a dispatch, run
npm run pstack:brief -- P0 S1 from a clean, published main checkout. This prints
requests; it does not invoke agents, make worktrees, change status or publish.
The coordinator reads the briefs and submits the valid requests through T3.
The generated base must match the tool caller's committed checkout. Refuse an
unexpected base before any edit. Independent work uses origin/main; dependent
work starts only after its prerequisites are accepted into that published base.

Dispatch does not lock tasks by itself. The single coordinator must record the
selected tasks active in work.json in a committed/published change before running
the requests and regenerate with `npm run pstack:brief -- --reserved P0 S1` at the new base. Use ready selection as a proposal,
not as a lock. At most one coordinator dispatches this repository at a time.

Upstream check-plan.mjs is preserved for reference, not used to claim this smaller
plan meets its ten-lane/screenshot/loop template. The project validator enforces
dependency readiness, disjoint active scopes and worker capacity. It does not
verify product correctness or evidence content. No /loop, background watchers or
Cursor automations are installed.

## Other upstream dependencies

cursor-team-kit control-ui/control-cli/deslop are not installed. Use existing npm
checks for local code cleanup. Real Electron control remains task C1; do not call
a missing harness a pass or substitute a browser preview unasked. Formal TLA+
verification is optional future work, not a prerequisite silently added to V1.
Cursor Bugbot, cloud dashboards and Automations are unavailable here. Record any
step requiring them as a capability gap; keep authorized independent work moving.
Installing skills does not grant authority to send messages, deploy, merge or
delete data beyond the user's task and session rules.
