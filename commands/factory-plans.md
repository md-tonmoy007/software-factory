---
description: Direct single-phase entry point for the plans phase. Invokes missing upstream phases first, then Odin/Odysseus.
---

# /factory-plans — direct single-phase mode

This command jumps straight to the **plans** phase of the Fellowship
pipeline, instead of driving the whole guided sequence the way `/factory`
does.

## Resolve the path first

Follow the "Resuming an already-resolved path" convention defined once in
`commands/factory.md`: reuse a `<path>` already resolved earlier in this
conversation if there is one; otherwise use a user-supplied argument/path
hint; otherwise list existing folders under the configured `folderName`
and ask the user which to use (or whether to start a new one). Only fall back to running **hodor** fresh (exactly as `/factory`'s own Step 0
does) when none of those apply. Use the same
`commands/factory.md` rule to tell whether a folder is system-level
(nested features, which also decides the road/level) or a standalone
phase-road folder.

If this is a feature nested under a system, also note the parent system
path `<folder-name>/<system-name>/` — the upstream agents this command
invokes (heimdal/hermione/salander/odysseus) need it to read the system's own
`plans/plan-ai.md` (and, for the researchers, `research-report-ai.md`) as
upstream context; see those agents' own files.

Heimdal and Askeladd are interactive agents dispatched as subagents — if
either asks the user something, follow the "User-input relay protocol" defined once in
`commands/factory.md`: relay the question, get the answer, and resume the
same agent.

Any of these agents may also need **code-explorer** dispatched for
grounded, file-level facts about existing code — follow the
"Code-exploration relay" mechanism defined once in `commands/factory.md`:
dispatch code-explorer standalone, feed its report back to the same
dispatched agent, and resume it.

These agents consult each other directly when one finds a gap in another's
domain. You only step in if a closing message starts with `REOPEN:` — see "Peer
consultation" in `commands/factory.md`.

## Core mechanism: check upstream artifacts before invoking

The plans phase comes after inquiry, research, and discussion in the phase
order (inquiry → research → discussion → plans → test → implement). Before invoking plans' own agent, check every required
upstream artifact with a plain file-existence test at `<path>`:

- **Required for this command:** `<path>/inquiry-report-ai.md`,
  `<path>/research-report-ai.md`, `<path>/discussion-report-ai.md`

For every required artifact that is **missing**, invoke that artifact's
owning upstream agent first, in upstream-to-downstream order (inquiry, then
research, then discussion), so each gets written before
you proceed. For every required artifact that **already exists**, use it
as-is and do **not** re-invoke the agent that would have written it —
never re-trigger an upstream agent whose artifact is already present.

Concretely for this command, check in this order:

1. Check `<path>/inquiry-report-ai.md`.
   - Missing → invoke **heimdal** at `<path>` first. It writes
     `<path>/inquiry-report-human.md` and `<path>/inquiry-report-ai.md`.
   - Present → skip heimdal, use the existing report as-is.
2. Check `<path>/research-report-ai.md`.
   - Missing → run the "Research step" from `commands/factory.md` at `<path>`.
   - Present → use the existing report as-is, unless that section says deep
     research is still owed.
3. Check `<path>/discussion-report-ai.md`.
   - Missing → invoke **askeladd** at `<path>`. It writes
     `<path>/discussion-report-human.md` and
     `<path>/discussion-report-ai.md`.
   - Present → skip askeladd, use the existing report as-is.

## Invoke this phase's own agent

Once all three upstream artifacts exist (whether already there or just
written above), invoke the plans agent:

- **odin** if this is a system-level run (workflow-road's own
  system-level sequence).
- **odysseus** if this is a feature-level run (plain phase-road, or a
  nested feature run under workflow-road).

The chosen agent writes `<path>/plans/plan-ai.md` (odin also writes
`<path>/plans/plan-human.md`).

Report the result to the user.
