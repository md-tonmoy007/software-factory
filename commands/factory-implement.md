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

Any of these agents may also need **code-explorer** dispatched for
grounded, file-level facts about existing code — follow the
"Code-exploration relay" mechanism defined once in `commands/factory.md`:
dispatch code-explorer standalone, feed its report back to the same
dispatched agent, and resume it.

Any of these agents may also discover a gap that belongs to a different
agent's domain (not code facts, not a user question) — follow the "Peer
consultation relay" mechanism defined once in `commands/factory.md`:
dispatch the named peer for a scoped consult (or, with the user's
confirmation, a full reopen), feed its answer back, and resume the asking
agent.

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
   fellowship:opencode-subagent skill). It writes `<path>/implementation-log.md`.
2. Invoke **l** at `<path>`, pass 2: evaluate Gru's implementation. It
   writes `<path>/test-report.md`.
3. Invoke **mimir** at `<path>` — this command is itself a terminal point
   (it ends with L Pass 2 and reports to the user, with no later step
   guaranteed to dispatch Mimir on its behalf), so per the "Memory
   available" section in `commands/factory.md`, Mimir runs here
   unconditionally, harvesting from `implementation-log.md`,
   `test-report.md`, and `evaluation-report.md`. Skip this step only if
   `<path>` is a workflow-road system-level path (no implementation
   occurred) — Mimir itself also recognizes this case and would write
   nothing, but it's cheaper not to dispatch it at all.

Report the result to the user, including Mimir's write-or-suppress
outcome.
