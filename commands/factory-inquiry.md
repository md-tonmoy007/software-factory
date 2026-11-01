---
description: Direct single-phase entry point for the inquiry phase. Invokes Heimdal only.
---

# /factory-inquiry — direct single-phase mode

This command jumps straight to the **inquiry** phase of the Fellowship
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
(nested features) or a standalone phase-road folder.

If this is a feature nested under a system (a folder detected as
system-level per that same rule), also note the parent system path
`<folder-name>/<system-name>/` — heimdal needs it to read the system's
`plans/plan-ai.md` as upstream context.

Heimdal is an interactive agent dispatched as a subagent — if it asks the
user something, follow
the "User-input relay protocol" defined once in the `fellowship:pipeline` skill:
relay the question, get the answer, and resume the same agent.

Heimdal may also need **code-explorer** dispatched for
grounded, file-level facts about existing code — follow the
"Code-exploration relay" mechanism defined once in the `fellowship:pipeline` skill:
dispatch code-explorer standalone, feed its report back, and resume the
same agent.

Heimdal may send Hermione scouts out on its own before asking the user something.
You don't need to do anything for that — see "Peer consultation" in
the `fellowship:pipeline` skill.

Inquiry is the first phase in the phase order (inquiry → research → discussion → plans → test → implement), so it has no upstream
artifact dependency to check.

## Required upstream artifacts

None. Inquiry is the first phase — there is nothing to check for.

## What to do

1. Resolve `<path>` as described above.
2. Invoke **heimdal** at `<path>` (passing the parent system path too, if
   this is a nested feature run). Heimdal writes
   `<path>/inquiry-report-human.md` and `<path>/inquiry-report-ai.md`.
3. Report heimdal's result to the user.
