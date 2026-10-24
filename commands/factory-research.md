---
description: Direct single-phase entry point for the research phase. Invokes Heimdal first if needed, then Hermione/Salander.
---

# /factory-research — direct single-phase mode

This command jumps straight to the **research** phase of the Fellowship
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

The research phase comes after inquiry in the phase order (inquiry →
research → brainstorm → discussion → plans → test → implement). Before
invoking research's own agent, check every required upstream artifact with
a plain file-existence test at `<path>`:

- **Required for this command:** `<path>/inquiry-report-ai.md`

For every required artifact that is **missing**, invoke that artifact's
owning upstream agent first (in upstream-to-downstream order), so it gets
written before you proceed. For every required artifact that **already
exists**, use it as-is and do **not** re-invoke the agent that would have
written it — never re-trigger an upstream agent whose artifact is already
present.

Concretely for this command:

1. Check `<path>/inquiry-report-ai.md`.
   - Missing → invoke **heimdal** at `<path>` first. It writes
     `<path>/inquiry-report-human.md` and `<path>/inquiry-report-ai.md`.
   - Present → skip heimdal, use the existing report as-is.

## Invoke this phase's own agent

Once `<path>/inquiry-report-ai.md` exists (whether it was already there or
heimdal just wrote it), invoke the research agent:

- **hermione** if this is a system-level run (workflow-road's own
  system-level sequence).
- **salander** if this is a feature-level run (plain phase-road, or a
  nested feature run under workflow-road).

The chosen agent writes `<path>/research-report-human.md` and
`<path>/research-report-ai.md`.

Report the result to the user.
