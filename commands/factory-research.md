---
description: Direct single-phase entry point for the research phase. Invokes Heimdal first if needed, then Hermione, and Salander when a question needs deep research. Say "deep" to ask for it.
---

# /factory-research — direct single-phase mode

This command jumps straight to the **research** phase of the Fellowship
pipeline, instead of driving the whole guided sequence the way `/factory`
does.

## Load the shared rules first

Before anything else, invoke the Skill tool with `skill: "fellowship:pipeline"`. It
holds the shared rules this command refers to by name. If it won't load, tell the
user and stop rather than guessing at them.

## Resolve the path first

Follow the "Resuming an already-resolved path" convention defined once in
the `fellowship:pipeline` skill: reuse a `<path>` already resolved earlier in this
conversation if there is one; otherwise use a user-supplied argument/path
hint; otherwise list existing folders under the configured `folderName`
and ask the user which to use (or whether to start a new one). Only fall back to running **hodor** fresh when none of those apply. Use the same rule from the `fellowship:pipeline` skill to tell whether a folder is system-level
(nested features, which also decides the road/level) or a standalone
phase-road folder.

If this is a feature nested under a system, also note the parent system
path `<folder-name>/<system-name>/` — the upstream agents this command
invokes (heimdal/hermione/salander/odysseus) need it to read the system's own
`plans/plan-ai.md` (and, for the researchers, `research-report-ai.md`) as
upstream context.

Heimdal and Askeladd are interactive agents dispatched as subagents — if
either asks the user something, follow the "User-input relay protocol" defined once in
the `fellowship:pipeline` skill: relay the question, get the answer, and resume the
same agent.

Any of these agents may also need **code-explorer** dispatched for
grounded, file-level facts about existing code — follow the
"Code-exploration relay" mechanism defined once in the `fellowship:pipeline` skill:
dispatch code-explorer standalone, feed its report back to the same
dispatched agent, and resume it.

These agents consult each other directly when one finds a gap in another's
domain. You only step in if a closing message starts with `REOPEN:` — see "Peer
consultation" in the `fellowship:pipeline` skill.

## Core mechanism: check upstream artifacts before invoking

The research phase comes after inquiry in the phase order (inquiry → research → discussion → plans → test → implement). Before
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
heimdal just wrote it), run the "Research step" defined in
the `fellowship:pipeline` skill. The level is system for a workflow-road system run, and
feature for plain phase-road or a nested feature.

If the user asks for deep research, tell Hermione so. If a report already exists
and the user only wants to go deeper on specific questions, invoke **salander**
alone with those questions instead of re-running Hermione.

Report the result to the user.
