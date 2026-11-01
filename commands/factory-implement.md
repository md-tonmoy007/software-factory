---
description: Direct single-phase entry point for the implement phase. Invokes missing upstream phases first, then Gru, then L (pass 2).
---

# /factory-implement — direct single-phase mode

This command jumps straight to the **implement** phase of the Fellowship
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

The implement phase is the last phase in the phase order (inquiry → research → discussion → plans → test → implement). It
depends on plans and on L's pass-1 tests, and plans itself depends on
inquiry, research, and discussion all being done first, so
this command must walk the whole upstream chain. Before invoking Gru,
check every required upstream artifact with a plain file-existence test at
`<path>`:

- **Required for this command:** `<path>/inquiry-report-ai.md`,
  `<path>/research-report-ai.md`, `<path>/discussion-report-ai.md`, `<path>/plans/plan-ai.md`, and L's
  pass-1 tests (the tests L writes against the plan)

For every required artifact that is **missing**, invoke that artifact's
owning upstream agent first, in upstream-to-downstream order, so each gets
written before you proceed. For every required artifact that **already
exists**, use it as-is and do **not** re-invoke the agent that would have
written it — never re-trigger an upstream agent whose artifact is already
present.

**Small-lane folders are different.** If `<path>` is small-lane (per "Detecting a
small-lane folder" in `commands/factory.md`), the only required upstream artifact
is `<path>/inquiry-report-ai.md`. It takes the plan's place, so skip the research,
discussion, and plan checks below and do not invoke those agents.

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
4. Check `<path>/plans/plan-ai.md`.
   - Missing → invoke **odin** (system-level run) or **odysseus**
     (feature-level run) at `<path>`. It writes `<path>/plans/plan-ai.md`.
   - Present → skip this agent, use the existing plan as-is.
5. Check for L's pass-1 tests at `<path>` (the tests L writes against the
   plan).
   - Missing → invoke **l** at `<path>`, pass 1: write tests against the
     plan.
   - Present → skip L's pass 1, use the existing tests as-is.

## Invoke this phase's own agents

Once the plan (or, for a small-lane folder, the inquiry report) and L's pass-1
tests both exist, whether already there or just written above:

1. Invoke **gru** at `<path>` (dispatches minions via the
   fellowship:opencode-subagent skill). It writes `<path>/implementation-log.md`.
2. Invoke **l** at `<path>`, pass 2: evaluate Gru's implementation. It appends its
   verdict to `<path>/test-report.md` and writes `<path>/evaluation-report.md`.
3. Follow the "Repair loop" defined once in `commands/factory.md`: on
   `VERDICT: FAIL`, run up to two repair rounds of Gru then L Pass 2 with no pause,
   and stop to ask the user if it still fails or if Gru reports `BLOCKED:`.
4. Run the Mimir screen from "Memory available" in `commands/factory.md`, and
   invoke **mimir** only if there's a signal. Never dispatch it for a workflow-road
   system-level `<path>`, since no implementation occurred.

Report the result to the user, including the final verdict, any repair rounds, and
either Mimir's write-or-suppress outcome or "Memory: nothing to record."
