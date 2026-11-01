---
description: Default entry point for the Fellowship pipeline. Picks a lane for your request and runs it, stopping only for Heimdal's inquiry and Askeladd's discussion, or when something goes wrong.
---

# /factory — default mode

You are driving the Fellowship pipeline for the request the user just gave
you (or is about to give you, if they invoked `/factory` with no argument —
in that case, ask what they want done before doing anything else).

Hand off between agents immediately. The user is only stopped at the points
listed in "Where the user is stopped" below. Never add a confirmation pause
between phases.

## Where the user is stopped

**Two planned stops:**

1. **Heimdal (inquiry)** — its questions about what to build.
2. **Askeladd (discussion)** — its ranked recommendation and the debate around
   it. The small lane has no Askeladd stop.

**Workflow-road also ends with a check:** the design-complete question after
Odin's plan (see "After the system-level plan").

**Exception stops.** Stop and ask the user only when:

- L's verdict is still `VERDICT: FAIL` after two repair rounds.
- Gru's closing message starts with `BLOCKED:`.
- An agent's closing message starts with `REOPEN:` (see "Peer consultation").
- A step would do something destructive or hard to reverse that the plan didn't
  call for.

Tell the user plainly what happened, what was tried, and what you need from
them. Never paper over it or call the run complete.

## The lanes

Hodor picks one of these and states it. If the user's request or a later
message names a different lane, follow the user.

| Lane | Sequence |
| --- | --- |
| Trivial | hodor → ullr → (mimir if there's a signal) |
| Small | hodor → heimdal (→ hermione scout if needed) ⏸ → l (Pass 1) → gru ⇄ l (Pass 2) → (mimir if there's a signal) |
| Feature (phase-road) | hodor → heimdal (→ hermione scouts if needed) ⏸ → hermione (→ salander if flagged) → askeladd ⏸ → odysseus → l (Pass 1) → gru ⇄ l (Pass 2) → (mimir if there's a signal) |
| System (workflow-road) | hodor → heimdal (→ hermione scouts if needed) ⏸ → hermione (→ salander if flagged) → askeladd ⏸ → odin → design-complete check ⏸ |

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
2. The main session (you, running this command) relays those exact questions to
   the user, verbatim or as close to verbatim as makes sense, and waits for the
   user's answer.
3. The main session then **resumes the same agent** — the same subagent/session
   that asked the question, not a fresh dispatch that has lost the agent's
   in-progress state — with the user's answer.
4. This repeats, possibly across several rounds, until the agent has everything
   it needs and produces its actual final report(s).

Every reference elsewhere in this command, in `factory-auto.md`, and in the
direct-phase commands to "invoke heimdal" or "invoke askeladd" means: dispatch
it, and if it comes back with a question instead of a final report, relay the
question, get the answer, resume the same agent, and repeat until you have its
final report. Other files reference this section rather than re-describing it.

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
2. The main session (you, running this command) dispatches **code-explorer**
   standalone with that area/question, per `agents/code-explorer.md`.
3. The main session feeds code-explorer's report back to the same dispatched
   agent (the same subagent/session, not a fresh dispatch) so it can continue
   with grounded facts instead of a guess.
4. This can repeat for multiple areas, and composes with the user-input relay
   protocol.

Every other command file in this plugin references this section rather than
restating it.

## Peer consultation (shared mechanism)

Agents talk to each other directly. When an agent finds a gap that belongs to another
agent's domain — not code facts, not a question for the user — it calls that peer
itself and they go back and forth, without coming through you. There is also one
parallel case: Heimdal can send out several Hermione scouts at once before asking the
user a question. Neither needs anything from you.

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

Every other command file in this plugin references this section rather than
restating it.

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

Every other command file in this plugin references this section rather than
restating it.

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

Every other command file in this plugin references this section rather than
restating it.

## Repair loop (shared mechanism)

L's Pass 2 closing message contains `VERDICT: PASS` or `VERDICT: FAIL`.

- **`VERDICT: PASS`** → the implementation is done. Move on to the Mimir screen.
- **`VERDICT: FAIL`** → run a repair round, with no pause: invoke **gru** and
  tell it this is repair round `<n>` (see "Repair mode" in `agents/gru.md`), then
  invoke **l** for Pass 2 again, telling it the same round number.
- **At most two repair rounds.** If the verdict is still `VERDICT: FAIL` after
  round 2, that's an exception stop: report the remaining failures and what was
  tried, and ask the user how to proceed. Run the Mimir screen afterward.
- If Gru's closing message starts with `BLOCKED:` at any point, that's an
  exception stop too. Don't run L against an implementation Gru says it couldn't
  build.

Every other command file in this plugin references this section rather than
restating it.

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

Every other command file in this plugin follows this same three-step rule rather
than restating it — they reference this section.

### Detecting system-level vs. standalone folders

A folder under `folderName` is **system-level** (a workflow-road system with
nested features) if it directly contains a `plans/` folder **and** has subfolders
that themselves contain their own `inquiry-qa.md` (i.e., it has nested features).
Otherwise, it is a **standalone phase-road folder**. Use plain `Read`/`Glob`
file-existence checks to apply this rule; every other command file references
this rule rather than restating it.

### Detecting a small-lane folder

A folder is **small-lane** if its `inquiry-report-ai.md` starts with
`Lane: small`. A small-lane run has no research, discussion, or plan artifacts on
purpose, so never treat them as missing upstream work when resuming it. Its
inquiry report takes the plan's place.

## Step 0: invoke Hodor

Hand the user's request to **hodor**. It handles project setup, picks the lane,
resolves `<path>`, and never asks the user anything. Then branch on its verdict
immediately, with no pause:

- **Trivial** → "The trivial path".
- **Small** → "The small lane".
- **Feature** → "The feature lane".
- **System** → "Workflow-road".

## The trivial path

Invoke **ullr** to make the direct fix, carrying forward what Hodor resolved.

If Ullr's closing message starts with `NOT TRIVIAL:`, Hodor's call was wrong. Tell
the user in one line, invoke **hodor** again telling it the request is small so it
resolves a `<path>`, and continue at "The small lane", passing Ullr's findings to
Heimdal.

Otherwise, run the Mimir screen (see "Memory available"), report Ullr's result,
and stop.

## The small lane

1. **heimdal** (short inquiry, tell it this is the small lane) — writes
   `<path>/inquiry-qa.md` and `<path>/inquiry-report-ai.md`, which starts with
   `Lane: small`. This is the stop.

   If its closing message says the request moved up to the feature lane (its
   report starts with `Lane: feature`), continue at "The feature lane" from step 2.
2. **l** (Pass 1: writes tests against the inquiry report's acceptance criteria).
3. **gru** (implement, dispatches minions via the fellowship:opencode-subagent
   skill) — writes `<path>/implementation-log.md`.
4. **l** (Pass 2: evaluates Gru's implementation) — appends its verdict to
   `<path>/test-report.md` and writes `<path>/evaluation-report.md`. Follow the
   "Repair loop".
5. Run the Mimir screen, report the outcome (what was built, the final verdict,
   and any repair rounds), and stop.

## The feature lane

This is the phase-road sequence. Each step hands straight to the next.

1. **heimdal** (inquiry, feature-level) — writes `<path>/inquiry-qa.md`,
   `<path>/inquiry-report-ai.md`, and `<path>/inquiry-report-human.md`. This is
   the first stop.
2. **Research step, feature level** (see "Research step") — hermione, then salander
   only if flagged. No stop. If this feature is nested under a system, pass the
   parent system path to heimdal, hermione, salander, and odysseus.
3. **askeladd** (decision) — writes `<path>/discussion-report-ai.md` and
   `<path>/discussion-report-human.md`. This is the second stop.
4. **odysseus** (plan, feature-level) — writes `<path>/plans/plan-ai.md`.
5. **l** (Pass 1: writes tests against the plan).
6. **gru** (implement, dispatches minions via the fellowship:opencode-subagent
   skill) — writes `<path>/implementation-log.md`.
7. **l** (Pass 2: evaluates Gru's implementation) — appends its verdict to
   `<path>/test-report.md` and writes `<path>/evaluation-report.md`. Follow the
   "Repair loop".
8. Run the Mimir screen, report the outcome (what was built, the key decisions
   from the plan, the final verdict, and any repair rounds), and stop.

## Workflow-road

Workflow-road runs **once, at the system level only**, under `<path>` =
`<folder-name>/<system-name>/`, and produces the overall architecture and phase
breakdown, identifying the features the system decomposes into.

1. **heimdal** (inquiry, system-level) — writes `<path>/inquiry-qa.md`,
   `<path>/inquiry-report-ai.md`, and `<path>/inquiry-report-human.md`. This is
   the first stop.
2. **Research step, system level** (see "Research step") — hermione, then salander
   only if flagged. No stop.
3. **askeladd** (decision) — writes `<path>/discussion-report-ai.md` and
   `<path>/discussion-report-human.md`. This is the second stop.
4. **odin** (plan, system-level) — writes `<path>/plans/plan-ai.md` and
   `<path>/plans/plan-human.md`.

**Workflow-road stops there.** It does not go deep into any individual feature,
and it never runs L, Gru, or Mimir. Report the plan — the features it identified,
their resolved `<folder-name>/<system-name>/<phase-name>/` paths, and the
recommended order. Implementing a given feature is a separate, later action: the
user invokes `/factory` or a direct-phase command against that feature's own path.

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

## How to run each step in practice

For every invocation in this command:

1. Say in one line which agent you're starting and why, so the user can follow
   along, but do not wait for a reply.
2. Invoke the agent, carrying forward conversational context (resolved path,
   road, lane, prior reports, anything already decided) rather than making it
   re-derive or re-ask for it.
3. When it finishes, move straight to the next step.

### Skipping a phase

Phases aren't offered for skipping, but if the user asks to skip one, do it.
Skipping a phase means its artifact will never exist at `<path>`, and a downstream
agent can't tell that apart from a real gap. So when you invoke the next agent,
tell it which phase was skipped and that the user chose to skip it. Carry that
note forward to every later agent in the sequence. An agent told about a skip
should say so plainly in its report rather than silently proceeding or erroring on
the missing file.

## What you must not do

- Do not add stops beyond the ones listed in "Where the user is stopped".
- Do not skip Hodor.
- Do not run L, Gru, or Mimir as part of a workflow-road system-level pass.
- Do not report a run as complete while the verdict is `VERDICT: FAIL` or Gru is
  blocked.
- Do not re-implement askeladd's re-entry/carry-forward detection logic in this
  command — just re-invoke askeladd and let it handle it.
- Do not use odin at the feature level or odysseus at the system level.
- Do not run salander unless hermione flagged questions or the user asked for deep
  research.
