---
description: Direct single-phase entry point for the brainstorm phase. Invokes Heimdal/Hermione-Salander first if needed, then Sherlock.
---

# /factory-brainstorm — direct single-phase mode

This command jumps straight to the **brainstorm** phase of the Fellowship
pipeline, instead of driving the whole guided sequence the way `/factory`
does.

## Resolve the path first

Follow the "Resuming an already-resolved path" convention defined once in
`commands/factory.md`: reuse a `<path>` already resolved earlier in this
conversation if there is one; otherwise use a user-supplied argument/path
hint; otherwise list existing folders under the configured `folderName`
and ask the user which to use (or whether to start a new one). Only fall
back to running **hodor** then **aragorn** fresh (exactly as `/factory`'s
own Step 0 and Step 1 do) when none of those apply. Use the same
`commands/factory.md` rule to tell whether a folder is system-level
(nested features, which also decides the road/level) or a standalone
phase-road folder.

If this is a feature nested under a system, also note the parent system
path `<folder-name>/<system-name>/` — the upstream agents this command
invokes (heimdal/salander/odysseus) need it to read the system's own
`plans/plan-ai.md` (and, for salander, `research-report-ai.md`) as
upstream context; see those agents' own files.

hodor, aragorn, and every phase agent this command may invoke are
interactive agents dispatched as subagents — if any of them asks the user
something, follow the "User-input relay protocol" defined once in
`commands/factory.md`: relay the question, get the answer, and resume the
same agent.

## Core mechanism: check upstream artifacts before invoking

The brainstorm phase comes after inquiry and research in the phase order
(inquiry → research → brainstorm → discussion → plans → test →
implement). Before invoking brainstorm's own agent, check every required
upstream artifact with a plain file-existence test at `<path>`:

- **Required for this command:** `<path>/inquiry-report-ai.md` and
  `<path>/research-report-ai.md`

For every required artifact that is **missing**, invoke that artifact's
owning upstream agent first, in upstream-to-downstream order (inquiry
before research), so each gets written before you proceed. For every
required artifact that **already exists**, use it as-is and do **not**
re-invoke the agent that would have written it — never re-trigger an
upstream agent whose artifact is already present.

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

## Invoke this phase's own agent

Once both `<path>/inquiry-report-ai.md` and `<path>/research-report-ai.md`
exist (whether already there or just written above), invoke **sherlock**
at `<path>` (brainstorm — same agent regardless of road). It writes
`<path>/brainstorm-report-human.md` and `<path>/brainstorm-report-ai.md`.

Report the result to the user.
