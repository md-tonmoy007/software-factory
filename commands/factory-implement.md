---
description: Direct single-phase entry point for the implement phase. Invokes missing upstream phases first, then Gru, then L (pass 2).
---

# /factory-implement — direct single-phase mode

This command jumps straight to the **implement** phase of the Fellowship
pipeline, instead of driving the whole guided sequence the way `/factory`
does.

## Resolve the path first

This command assumes Hodor/Aragorn triage has already placed the user at a
resolved `<path>` (the folder Aragorn resolved — `<folder-name>/<phase-name>/`
on phase-road, or `<folder-name>/<system-name>/` on workflow-road, or a
nested `<folder-name>/<system-name>/<phase-name>/` for a feature run), and
has already decided which road (phase-road vs workflow-road) and which
level (system-level vs feature-level) applies. If that has not happened yet
in this conversation, run **hodor** then **aragorn** first, exactly as
`/factory`'s own Step 0 and Step 1 do, before continuing.

## Core mechanism: check upstream artifacts before invoking

The implement phase is the last phase in the phase order (inquiry →
research → brainstorm → discussion → plans → test → implement). It
depends on plans and on L's pass-1 tests, and plans itself depends on
inquiry, research, brainstorm, and discussion all being done first, so
this command must walk the whole upstream chain. Before invoking Gru,
check every required upstream artifact with a plain file-existence test at
`<path>`:

- **Required for this command:** `<path>/inquiry-report-ai.md`,
  `<path>/research-report-ai.md`, `<path>/brainstorm-report-ai.md`,
  `<path>/discussion-report-ai.md`, `<path>/plans/plan-ai.md`, and L's
  pass-1 tests (the tests L writes against the plan)

For every required artifact that is **missing**, invoke that artifact's
owning upstream agent first, in upstream-to-downstream order, so each gets
written before you proceed. For every required artifact that **already
exists**, use it as-is and do **not** re-invoke the agent that would have
written it — never re-trigger an upstream agent whose artifact is already
present.

Concretely for this command, check in this order:

1. Check `<path>/inquiry-report-ai.md`.
   - Missing → invoke **heimdal** at `<path>` first. It writes
     `<path>/inquiry-report-human.md` and `<path>/inquiry-report-ai.md`.
   - Present → skip heimdal, use the existing report as-is.
2. Check `<path>/research-report-ai.md`.
   - Missing → invoke **hermione** (system-level run) or **salander**
     (feature-level run) at `<path>`. It writes
     `<path>/research-report-human.md` and `<path>/research-report-ai.md`.
   - Present → skip this agent, use the existing report as-is.
3. Check `<path>/brainstorm-report-ai.md`.
   - Missing → invoke **sherlock** at `<path>`. It writes
     `<path>/brainstorm-report-human.md` and
     `<path>/brainstorm-report-ai.md`.
   - Present → skip sherlock, use the existing report as-is.
4. Check `<path>/discussion-report-ai.md`.
   - Missing → invoke **askeladd** at `<path>`. It writes
     `<path>/discussion-report-human.md` and
     `<path>/discussion-report-ai.md`.
   - Present → skip askeladd, use the existing report as-is.
5. Check `<path>/plans/plan-ai.md`.
   - Missing → invoke **odin** (system-level run) or **odysseus**
     (feature-level run) at `<path>`. It writes
     `<path>/plans/plan-human.md` and `<path>/plans/plan-ai.md`.
   - Present → skip this agent, use the existing plan as-is.
6. Check for L's pass-1 tests at `<path>` (the tests L writes against the
   plan).
   - Missing → invoke **l** at `<path>`, pass 1: write tests against the
     plan.
   - Present → skip L's pass 1, use the existing tests as-is.

## Invoke this phase's own agents

Once the plan and L's pass-1 tests both exist (whether already there or
just written above):

1. Invoke **gru** at `<path>` (dispatches minions via the
   opencode-subagent skill). It writes `<path>/implementation-log.md`.
2. Invoke **l** at `<path>`, pass 2: evaluate Gru's implementation. It
   writes `<path>/test-report.md`.

Report the result to the user.
