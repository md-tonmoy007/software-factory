---
name: pipeline
description: Shared rules for the Fellowship commands, covering relays, peer consultation, the research step, the repair loop, memory, and how to resume a run. Loaded by the factory commands; not for direct use.
user-invocable: false
---

# Fellowship pipeline: shared rules

You are the main session driving a Fellowship command. These rules apply to every
command in the plugin. Commands refer to these sections by name.

## User-input relay protocol (shared mechanism)

**Heimdal** and **Askeladd** are interactive by design, but each runs as a
**subagent dispatch**: it executes once and returns a single final message, so
it cannot hold a live back-and-forth with the user the way this top-level
command can.

The mechanism that makes this work, used by both agents and by every command
file that invokes them:

1. When the dispatched agent needs to ask the user something, it returns its
   question(s) as its result and **stops** — it does not guess or invent an
   answer on the user's behalf.
2. The main session (you) relays those exact questions to
   the user, verbatim or as close to verbatim as makes sense, and waits for the
   user's answer.
3. The main session then **resumes the same agent** — the same subagent/session
   that asked the question, not a fresh dispatch that has lost the agent's
   in-progress state — with the user's answer word for word, starting with
   `User's reply:` so the agent knows it's from the user.
4. This repeats, possibly across several rounds, until the agent has everything
   it needs and produces its actual final report(s).

Every reference in the Fellowship commands to "invoke heimdal" or "invoke askeladd" means: dispatch
it, and if it comes back with a question instead of a final report, relay the
question, get the answer, resume the same agent, and repeat until you have its
final report.

## Code-exploration relay (shared mechanism)

**code-explorer** is not part of the main phase sequence — it is a standalone,
read-only agent any phase can call on when it needs grounded, file-level facts
about how an existing part of the codebase actually works, rather than guessing
or inferring from the plan/reports alone. Heimdal, Hermione, Salander, Askeladd,
Odin, Odysseus, L, Gru, and Ullr may all request this, in the same
dispatch-and-relay shape as the user-input relay protocol above, but for code
facts instead of user answers:

1. When a dispatched agent decides it needs code-explorer (an existing
   feature/area it must understand before it can decide or write anything, and
   it cannot determine that safely itself from its own tools), it states the
   area/question needing exploration as part of its result and stops there for
   that sub-need, rather than guessing at how the existing code works.
2. The main session (you) dispatches **code-explorer**
   standalone with that area/question.
3. The main session feeds code-explorer's report back to the same dispatched
   agent (the same subagent/session, not a fresh dispatch) so it can continue
   with grounded facts instead of a guess.
4. This can repeat for multiple areas, and composes with the user-input relay
   protocol.

## Peer consultation (shared mechanism)

Agents talk to each other directly. When an agent finds a gap that belongs to another
agent's domain — not code facts, not a question for the user — it calls that peer
itself and they go back and forth, without coming through you. There is also one
parallel case: Heimdal and Askeladd can send out several Hermione scouts at once when
they need outside facts, and Askeladd can call Salander if the user agrees to the
wait. None of this needs anything from you.

1. **Consult.** The asker calls the peer with the `Agent` tool, starting the prompt
   with `CONSULT:`. The peer answers that one question from its own reports. It can't
   start consultations of its own or ask the user, which keeps this one level deep.
2. **Back and forth.** To push back or follow up, the asker calls the peer again with
   the earlier exchange included, for up to three rounds per gap.
3. **Escalation.** If the peer's earlier work is wrong, the answer needs the user, or
   three rounds don't settle it, the asker returns a message starting
   `REOPEN: <phase> — <why>`. This is an exception stop: ask the user whether to
   formally reopen and rerun that phase. If they agree, rerun it, then resume the same
   asking agent with the updated report. Do not reopen a phase on an agent's say-so
   alone.
4. **Fallback.** If an agent has no `Agent` tool (subagent nesting is turned off), it
   states the question and peer in its result and stops instead. Dispatch that peer
   with the `CONSULT:` prompt, then resume the asker with the answer.

**Natural peer pairings** (the agent files name who each one may consult):

- **Hermione, Salander** → **Heimdal**: a requirement needs clarifying.
- **Askeladd** → **Heimdal**, **Hermione**, **Salander**: a recommendation depends on
  a requirement or finding that isn't there yet.
- **Odin, Odysseus** → **Hermione**, **Salander**, **Heimdal**, **Askeladd**, and each
  other when a system decision conflicts with a feature plan.
- **L** → the plan's author (**Heimdal** in the small lane), and **Gru** in Pass 2.
- **Gru** → the plan's author (**Heimdal** in the small lane), **L**.

## Memory available (shared mechanism)

The target project (never this plugin repo) has a memory wiki at
`<target>/.fellowship/memory/wiki/` — an append-only record of debug/patch
episodes, laid out and schemed by the `fellowship:memory` skill. **Mimir** is the
sole writer and runs terminally, never mid-pipeline. **Hermione, Salander, Gru, L,
and Ullr** may read it, self-service, at their own point of need; no other agent
reads or writes it in v1. **Hodor** scaffolds the directory and its gitignore
exemption but performs zero memory reads of its own.

**Only dispatch Mimir when there's a signal.** At the end of an implementation
run, apply this cheap screen yourself:

- **Trivial path:** Ullr's closing message contains a `Root cause:` or
  `Tried and rejected:` line.
- **Small and feature lanes:** a repair round ran, or
  `<path>/implementation-log.md` has a non-empty `failed_approaches` list or a
  `status: blocked` / `status: failed` entry.

If there's a signal, invoke **mimir** and report its write-or-suppress outcome.
If not, skip it and say "Memory: nothing to record." Workflow-road never
dispatches Mimir, because no implementation occurred.

Memory is never load-bearing: any failure in this mechanism is logged by Mimir
and the run continues regardless — it can never fail a pipeline run.

## Research step (shared mechanism)

Research runs by depth, on both the feature and system lanes. Every research step
in this plugin means:

1. Invoke **hermione**, telling it the level (system or feature), the parent system
   path if this feature is nested, and whether the user asked for deep research.
   It writes `<path>/research-report-ai.md`.
2. Read the `DEEP RESEARCH:` line in its closing message.
   - `DEEP RESEARCH: none` → research is done.
   - `DEEP RESEARCH: <questions>` → invoke **salander** with those questions, the
     level, and the parent system path if any. It adds a `## Deep research` section
     to the same report. Do not pause or ask the user first.

**Deep research still owed:** if `<path>/research-report-ai.md` already exists, its
`DEEP RESEARCH:` line names questions, and it has no `## Deep research` section, the
run was interrupted. Invoke **salander** alone rather than re-running Hermione.

## Repair loop (shared mechanism)

L's Pass 2 closing message contains `VERDICT: PASS` or `VERDICT: FAIL`.

- **`VERDICT: PASS`** → the implementation is done. Move on to the Mimir screen.
- **`VERDICT: FAIL`** → run a repair round, with no pause: invoke **gru** and
  tell it this is repair round `<n>`, then
  invoke **l** for Pass 2 again, telling it the same round number.
- **At most two repair rounds.** If the verdict is still `VERDICT: FAIL` after
  round 2, that's an exception stop: report the remaining failures and what was
  tried, and ask the user how to proceed. Run the Mimir screen afterward.
- If Gru's closing message starts with `BLOCKED:` at any point, that's an
  exception stop too. Don't run L against an implementation Gru says it couldn't
  build.

## Resuming an already-resolved path (shared convention)

Before invoking Hodor fresh to resolve `<path>`, check in this order:

1. **Conversational context first.** If a `<path>` was already resolved earlier
   in this same conversation (not a fresh disk read — the actual session
   context), reuse it. Do not re-run Hodor to re-derive something you already
   have.
2. **A user-supplied hint second.** If the user supplied an argument or path hint
   when invoking the slash command (e.g. `/factory-research my-feature`), use
   that to locate or build `<path>` under the configured `folderName`.
3. **Otherwise, ask.** List the existing folders under the configured
   `folderName` (from `.fellowship/config.json`) and ask the user which one to
   use, or whether to start a new one. Do not silently invent a new folder name
   via a fresh Hodor run when the user might have meant an existing one.

### Detecting system-level vs. standalone folders

A folder under `folderName` is **system-level** (a workflow-road system with
nested features) if it directly contains a `plans/` folder **and** has subfolders
that themselves contain their own `inquiry-qa.md` (i.e., it has nested features).
Otherwise, it is a **standalone phase-road folder**. Use plain `Read`/`Glob`
file-existence checks to apply this rule.

### Detecting a small-lane folder

A folder is **small-lane** if its `inquiry-report-ai.md` starts with
`Lane: small`. A small-lane run has no research, discussion, or plan artifacts on
purpose, so never treat them as missing upstream work when resuming it. Its
inquiry report takes the plan's place.

### After the system-level plan: design-complete check

Ask the user whether the system-level design is complete. Their answer branches:

- **"No, start over"** (the rare case) — a full reset. **Before re-invoking
  anything,** archive the existing report files rather than deleting them: move
  `inquiry-qa.md`, every `*-report-human.md` / `*-report-ai.md` file, and the
  `plans/` folder aside into a timestamped subfolder, e.g.
  `<path>/.archive-<timestamp>/`. This gives askeladd and heimdal a genuinely
  clean slate so they don't mistake leftover files for a re-entry. Then redo the
  system level from scratch, starting at **heimdal**.
- **"No, but let's discuss further"** (the common case) — re-invoke **askeladd**
  at the system level. Do not duplicate its carry-forward logic yourself: it
  detects the existing `discussion-report-ai.md` at `<path>` on its own and picks
  the discussion back up. Then re-run **odin**, report the updated plan, and ask
  again.
- **"Yes, complete"** — the workflow-road run is done. Report completion and stop.
