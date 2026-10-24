---
description: Direct single-phase entry point for the inquiry phase. Invokes Heimdal only.
---

# /factory-inquiry — direct single-phase mode

This command jumps straight to the **inquiry** phase of the Fellowship
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
(nested features) or a standalone phase-road folder.

If this is a feature nested under a system (a folder detected as
system-level per that same rule), also note the parent system path
`<folder-name>/<system-name>/` — heimdal needs it to read the system's
`plans/plan-ai.md` as upstream context (see `agents/heimdal.md`).

Both hodor and aragorn, like heimdal itself, are interactive agents
dispatched as subagents — if any of them asks the user something, follow
the "User-input relay protocol" defined once in `commands/factory.md`:
relay the question, get the answer, and resume the same agent.

Inquiry is the first phase in the phase order (inquiry → research →
brainstorm → discussion → plans → test → implement), so it has no upstream
artifact dependency to check.

## Required upstream artifacts

None. Inquiry is the first phase — there is nothing to check for.

## What to do

1. Resolve `<path>` as described above.
2. Invoke **heimdal** at `<path>` (passing the parent system path too, if
   this is a nested feature run). Heimdal writes
   `<path>/inquiry-report-human.md` and `<path>/inquiry-report-ai.md`.
3. Report heimdal's result to the user.
