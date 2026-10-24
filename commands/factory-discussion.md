---
description: Direct single-phase entry point for the discussion phase. Invokes missing upstream phases first, then Askeladd.
---

# /factory-discussion — direct single-phase mode

This command jumps straight to the **discussion** phase of the Fellowship
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

The discussion phase comes after inquiry, research, and brainstorm in the
phase order (inquiry → research → brainstorm → discussion → plans → test →
implement). Before invoking discussion's own agent, check every required
upstream artifact with a plain file-existence test at `<path>`:

- **Required for this command:** `<path>/inquiry-report-ai.md`,
  `<path>/research-report-ai.md`, `<path>/brainstorm-report-ai.md`

For every required artifact that is **missing**, invoke that artifact's
owning upstream agent first, in upstream-to-downstream order (inquiry,
then research, then brainstorm), so each gets written before you proceed.
For every required artifact that **already exists**, use it as-is and do
**not** re-invoke the agent that would have written it — never re-trigger
an upstream agent whose artifact is already present.

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

## Invoke this phase's own agent

Once all three upstream artifacts exist (whether already there or just
written above), invoke **askeladd** at `<path>` (discussion — same agent
regardless of road). It writes `<path>/discussion-report-human.md` and
`<path>/discussion-report-ai.md`. If `<path>/discussion-report-ai.md`
already exists from a prior run, askeladd will detect it on its own and
pick the discussion back up — you do not need to do anything special
beyond invoking it.

Report the result to the user.
