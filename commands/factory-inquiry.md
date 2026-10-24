---
description: Direct single-phase entry point for the inquiry phase. Invokes Heimdal only.
---

# /factory-inquiry — direct single-phase mode

This command jumps straight to the **inquiry** phase of the Fellowship
pipeline, instead of driving the whole guided sequence the way `/factory`
does.

## Resolve the path first

This command assumes Hodor/Aragorn triage has already placed the user at a
resolved `<path>` (the folder Aragorn resolved — `<folder-name>/<phase-name>/`
on phase-road, or `<folder-name>/<system-name>/` on workflow-road, or a
nested `<folder-name>/<system-name>/<phase-name>/` for a feature run). If
that has not happened yet in this conversation, run **hodor** then
**aragorn** first, exactly as `/factory`'s own Step 0 and Step 1 do, to get
the triage verdict and the resolved `<path>` before continuing.

Inquiry is the first phase in the phase order (inquiry → research →
brainstorm → discussion → plans → test → implement), so it has no upstream
artifact dependency to check.

## Required upstream artifacts

None. Inquiry is the first phase — there is nothing to check for.

## What to do

1. Resolve `<path>` as described above.
2. Invoke **heimdal** at `<path>`. Heimdal writes
   `<path>/inquiry-report-human.md` and `<path>/inquiry-report-ai.md`.
3. Report heimdal's result to the user.
