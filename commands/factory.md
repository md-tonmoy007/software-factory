---
description: Guided-mode entry point for the Fellowship pipeline. Drives the whole agent sequence, pausing for your confirmation before every handoff.
---

# /factory — guided mode

You are driving the Fellowship pipeline for the request the user just gave
you (or is about to give you, if they invoked `/factory` with no argument —
in that case, ask what they want done before doing anything else).

This command is the **guided-mode** entry point: after every agent in the
sequence below finishes its work, you **pause** and ask the user to confirm
before invoking the next agent. For any phase (not the routing agents —
see "Which steps always run" below), the user may say "skip this one" (or
equivalent) and you move to the next step without invoking that agent. You
never auto-advance through the whole pipeline — confirmation is required at
every single handoff, every time.

## User-input relay protocol (shared mechanism)

Five agents in this pipeline are interactive by design: **hodor**,
**aragorn**, **heimdal**, **sherlock**, and **askeladd**. Each of them may
need to ask the user something mid-task (Hodor's first-run setup
questions, Aragorn's road question, Heimdal's inquiry questions,
Sherlock's follow-up questions, Askeladd's debate). But every one of these
agents runs as a **subagent dispatch**: it executes once and returns a
single final message — it cannot hold a live back-and-forth with the user
the way this top-level command can.

The mechanism that makes this work, used by all five agents and by every
command file that invokes them (`factory.md`, `factory-auto.md`, and every
`commands/factory-<phase>.md` direct-phase command):

1. When the dispatched agent needs to ask the user something, it returns
   its question(s) as its result and **stops** — it does not guess, does
   not fabricate an answer, and does not invent a plausible-sounding
   response on the user's behalf.
2. The main session (you, running this command) relays those exact
   questions to the user, verbatim or as close to verbatim as makes sense,
   and waits for the user's answer.
3. The main session then **resumes the same agent** — the same
   subagent/session that asked the question, not a fresh dispatch that has
   lost the agent's in-progress state — with the user's answer.
4. This repeats, possibly across several rounds, until the agent has
   everything it needs and produces its actual final report(s) (its
   written files and its closing message to you).

Every reference elsewhere in this command, in `factory-auto.md`, and in
the direct-phase commands to "invoke heimdal," "invoke sherlock," "invoke
askeladd," "invoke hodor," or "invoke aragorn" means: dispatch it, and if
it comes back with a question instead of a final report, relay the
question, get the answer, resume the same agent, and repeat until you have
its final report. Do not re-describe this mechanism in those other files —
they reference this section instead.

## Code-exploration relay (shared mechanism)

**code-explorer** is not part of the 8-phase sequence — it is a standalone,
read-only agent any phase can call on when it needs grounded, file-level
facts about how an existing part of the codebase actually works, rather than
guessing or inferring from the plan/reports alone. Every phase agent in this
plugin (Aragorn, Heimdal, Hermione, Salander, Sherlock, Askeladd, Odin,
Odysseus, L, Gru, Ullr) may request this, same dispatch-and-relay shape as
the user-input relay protocol above, but for code facts instead of user
answers:

1. When a dispatched agent decides it needs code-explorer (an existing
   feature/area it must understand before it can decide or write anything,
   and it cannot determine that safely itself from its own tools), it
   states the area/question needing exploration as part of its result and
   stops there for that sub-need, rather than guessing at how the existing
   code works.
2. The main session (you, running this command) dispatches **code-explorer**
   standalone with that area/question, per `agents/code-explorer.md`.
3. The main session feeds code-explorer's report back to the same
   dispatched agent (the same subagent/session, not a fresh dispatch) so it
   can continue with grounded facts instead of a guess.
4. This can repeat for multiple areas, and composes with the user-input
   relay protocol — an agent may need both a code-explorer round and a
   user-answer round before it produces its final report.

Every other command file in this plugin references this section rather than
restating it.

## Peer consultation relay (shared mechanism)

This pipeline is not purely sequential hand-off. Any of the 12 agents may,
mid-task, discover that **another agent's domain** — not code facts, not a
user-facing question, but a judgment call that properly belongs to a
different phase — has a gap it cannot responsibly fill itself. The
canonical case: Odysseus, writing the feature-level plan, realizes Salander's
feature research didn't cover something the plan now depends on. Rather
than guessing at that research itself, or silently writing the plan around
the gap, Odysseus should be able to put the question to Salander directly.
Every agent in this plugin may do the equivalent for its own situation.

Agents cannot talk to each other directly — each one still runs as a single
subagent dispatch that executes once and returns. This relay is how the main
session (you) brokers that conversation, same dispatch-and-relay shape as
the two relays above, but between two pipeline agents instead of between an
agent and the user, or an agent and code-explorer:

1. The dispatched agent (the "asker") identifies the specific peer agent
   whose domain the gap falls in, states the precise question or gap in its
   result (with enough context that the peer doesn't need to re-derive
   anything), and stops there for that sub-need.
2. **Default: quick consult.** Dispatch the named peer agent with that
   specific question, framed explicitly as a scoped consultation, not a
   request to redo its whole phase — point it at its own existing report
   file(s) for context rather than re-running its full process. The peer
   answers the question (and, if the answer is simple to fold in, may amend
   its own report file to record it) and returns.
3. **Escalation: reopening a phase.** If the asker's question reveals the
   peer's existing work is genuinely insufficient or wrong — not just
   missing one answerable detail — the asker should say so plainly instead
   of asking a narrow question. In that case, pause and ask the user whether
   to formally reopen and rerun that phase (the same confirmation point as
   skipping a phase, just an unplanned reopening instead of a skip) before
   dispatching the peer for a full rerun. Do not silently reopen a phase on
   an agent's say-so alone.
4. Feed the peer's answer (quick consult) or updated report (reopened
   phase) back to the same asking agent (the same subagent/session, not a
   fresh dispatch) and resume it.
5. This composes with the other two relays above — one agent's turn may
   involve a code-explorer round, a peer-consultation round, and a
   user-answer round before it produces its final report.

**Natural peer pairings** (a starting point, not an exhaustive whitelist —
use judgment for a gap that doesn't fit neatly):

- **Heimdal** (inquiry) ↔ **Hermione/Salander** (research), **Sherlock**
  (brainstorm): a requirement surfaces later as unclear or incomplete.
- **Hermione/Salander** (research) ↔ **Heimdal**: a requirement needs
  clarifying before research can proceed.
- **Sherlock** (brainstorm) ↔ **Heimdal**, **Hermione/Salander**: a
  recommendation depends on a requirement or research finding that isn't
  there yet.
- **Askeladd** (discussion) ↔ **Sherlock**, **Hermione/Salander**: the
  debate surfaces a gap in the ranked recommendations or their research
  basis.
- **Odin** (system plan) ↔ **Hermione** (system research), **Heimdal**,
  **Sherlock/Askeladd**, and ↔ **Odysseus** when a system-level plan
  decision conflicts with a nested feature plan.
- **Odysseus** (feature plan) ↔ **Salander** (feature research) — the
  canonical case above — and the same upstream agents as Odin, scaled to
  one feature.
- **L Pass 1** (tests) ↔ **Odin/Odysseus**: an acceptance criterion is
  ambiguous or untestable as written.
- **Gru** (implement) ↔ **Odin/Odysseus**, **L**: the plan or a test
  assumes something the implementation can't actually satisfy as specified.
- **L Pass 2** (evaluate) ↔ **Gru**, **Odin/Odysseus**: before writing a
  fail verdict, confirm whether a gap is an implementation miss or a plan
  ambiguity.

Every other command file in this plugin references this section rather than
restating it.

## Memory available (shared mechanism)

The target project (never this plugin repo) has a memory wiki at
`<target>/.fellowship/memory/wiki/` — an append-only record of
debug/patch episodes, laid out and schemed by the `fellowship:memory`
skill. **Mimir** is the sole writer and runs terminally, never
mid-pipeline: after **ullr** on the trivial path, and after **l**'s Pass 2
(following Gru) on the full phase-road pipeline. Four agents —
**salander, gru, l, ullr** — may read it, self-service, at their own
point of need; no other agent reads or writes it in v1. **hodor**
scaffolds the directory and its gitignore exemption at target-project
setup time but performs zero memory reads of its own. **Workflow-road
runs do not dispatch Mimir** — no implementation occurs at the system
level, so there is nothing to harvest.

Memory is never load-bearing: any failure in this mechanism (missing
directory, a secrets-scan suppression, anything else) is logged by Mimir
and the run continues regardless — it can never fail a pipeline run.

Every other command file in this plugin references this section rather
than restating it.

## Resuming an already-resolved path (shared convention)

Before invoking Hodor/Aragorn fresh to resolve `<path>`, check in this
order:

1. **Conversational context first.** If a `<path>` was already resolved
   earlier in this same conversation (not a fresh disk read — the actual
   session context), reuse it. Do not re-run Hodor/Aragorn to re-derive
   something you already have.
2. **A user-supplied hint second.** If the user supplied an argument or
   path hint when invoking the slash command (e.g. `/factory-research
   my-feature`), use that to locate or build `<path>` under the configured
   `folderName`.
3. **Otherwise, ask.** List the existing folders under the configured
   `folderName` (from `.fellowship/config.json`) and ask the user which one
   to use, or whether to start a new one. Do not silently invent a new
   folder name via a fresh Aragorn run when the user might have meant an
   existing one.

Every other command file in this plugin (`factory-auto.md` and every
`commands/factory-<phase>.md` direct-phase command) follows this same
three-step rule rather than restating it — they reference this section.

### Detecting system-level vs. standalone folders

A folder under `folderName` is **system-level** (a workflow-road system
with nested features) if it directly contains a `plans/` folder **and**
has subfolders that themselves contain their own `inquiry-qa.md` (i.e., it
has nested features). Otherwise, it is a **standalone phase-road folder**.
Use plain `Read`/`Glob` file-existence checks to apply this rule; every
other command file references this rule rather than restating it.

## Which steps always run vs. which can be skipped

- **Hodor** and **Aragorn** always run. They are triage/routing, not
  phases — the user cannot skip them. (Hodor's first-run config setup is
  part of Hodor's own job; see `agents/hodor.md`.)
- Every phase from Heimdal onward (inquiry, research, brainstorm,
  discussion, plans, L Pass 1, Gru, L Pass 2) can be skipped on the user's
  explicit say-so for this request, if they judge it unnecessary. Ask,
  don't assume — present the next phase and let them decide.

## Step 0: invoke Hodor

Hand the user's request to **hodor**. Hodor handles first-run
`.fellowship/config.json` setup if needed, then triages the request as
trivial or non-trivial.

- No confirmation pause before Hodor — it is the entry point, it always
  runs first.
- When Hodor finishes, branch on its verdict:
  - **Trivial** → go to "Trivial path" below. Done, no further phases.
  - **Non-trivial** → go to Step 1 (Aragorn). No confirmation pause
    between Hodor and Aragorn either — both are routing agents, not
    phases, and always run back to back.

## Trivial path

Invoke **ullr** to make the direct fix, carrying forward whatever Hodor
already resolved conversationally (config values, the request itself).
Once Ullr finishes, invoke **mimir** (no confirmation pause — this
dispatch is unconditional, the same way Hodor → Ullr runs without one;
see "Memory available" above) to harvest a wiki entry from Ullr's report
if the write gate warrants one. Once Mimir finishes, the pipeline is
complete — report both Ullr's result and Mimir's write-or-suppress
outcome to the user and stop.

## Step 1: invoke Aragorn

Invoke **aragorn**. Aragorn decides phase-road (single feature) vs
workflow-road (whole system) and resolves the folder path:

- Phase-road: `<folder-name>/<phase-name>/`
- Workflow-road: `<folder-name>/<system-name>/`

Aragorn always runs, no confirmation pause before it. Once Aragorn hands
off, you know the road and the resolved `<path>`. Branch:

- **Phase-road** → run the phase-road sequence below once, rooted at
  `<path>` = `<folder-name>/<phase-name>/`.
- **Workflow-road** → run the system-level sequence only. See
  "Workflow-road" below. Implementing any individual feature happens
  later, as its own separate phase-road run.

## The phase-road sequence (phases 1–8)

This is the core sequence. It runs exactly once for a phase-road request,
or once for workflow-road's own system-level pass (steps 1–5 only — see
"Workflow-road" below). It also runs, independently and later, whenever
the user (or you, on their instruction) starts a fresh phase-road request
rooted at one of the feature paths a system-level plan identified. Every
step here is a phase: ask for confirmation after the previous step
finishes, before invoking the next one, and allow "skip this one" for any
of them.

1. **heimdal** (inquiry) — writes `<path>/inquiry-report-human.md` and
   `<path>/inquiry-report-ai.md`.
2. **hermione** (research, system-level) or **salander** (research,
   feature-level) — pick by road: use hermione when this sequence is
   running at the system level (workflow-road's own phases 1–5), use
   salander when this sequence is running at the feature level (plain
   phase-road, or a nested feature run under workflow-road). Writes
   `<path>/research-report-human.md` and `<path>/research-report-ai.md`.
3. **sherlock** (brainstorm, same agent either road) — writes
   `<path>/brainstorm-report-human.md` and
   `<path>/brainstorm-report-ai.md`.
4. **askeladd** (discussion, same agent either road) — writes
   `<path>/discussion-report-human.md` and
   `<path>/discussion-report-ai.md`. (On a workflow-road re-entry after
   "let's discuss further," re-invoking askeladd here is exactly how that
   carry-forward happens — askeladd detects its own prior
   `discussion-report-ai.md` and picks the discussion back up; you do not
   need to do anything special beyond invoking it again.)
5. **odin** (plans, system-level) or **odysseus** (plans, feature-level) —
   pick by the same rule as step 2: odin when running at the system level,
   odysseus when running at the feature level. Writes
   `<path>/plans/plan-human.md` and `<path>/plans/plan-ai.md`.

   **Only continue to steps 6–8 below when this is a phase-road request**
   — a standalone feature, or a later run started against one of the
   feature paths a system-level plan identified. When this sequence is
   workflow-road's own system-level pass (steps 1–5 at the system level,
   producing the high-level design and phase breakdown), stop after
   odin's plan and go to "Workflow-road" below instead — workflow-road
   never implements anything itself.

6. **l** (Pass 1: writes tests against the plan).
7. **gru** (implement, dispatches minions via the fellowship:opencode-subagent
   skill) — writes `<path>/implementation-log.md`.
8. **l** (Pass 2: evaluates Gru's implementation) — writes
   `<path>/test-report.md`.
9. **mimir** — runs terminally, unconditional dispatch (no confirmation
   pause, same as the trivial path's Hodor → Ullr → Mimir), harvesting
   from `implementation-log.md`, `test-report.md`, and
   `evaluation-report.md` per the "Memory available" section above.

After step 9, the phase-road sequence for this `<path>` is complete.

## Workflow-road

Workflow-road runs the phase-road sequence's steps 1–5 **once, at the
system level only**, under `<path>` = `<folder-name>/<system-name>/`,
using **hermione** (not salander) and **odin** (not odysseus) for steps 2
and 5. This produces the overall architecture / high-level design and
phase breakdown plan (`<path>/plans/plan-human.md`,
`<path>/plans/plan-ai.md`), identifying the individual features the
system decomposes into — their names, scope, and dependency order.

**Workflow-road stops there.** It does not go deep into any individual
feature, and it does not run the phase-road sequence per feature itself.
Steps 6–9 (L Pass 1, Gru, L Pass 2, Mimir) never run at the system level
— Mimir is not dispatched on this road at all, since no implementation
occurred and there is nothing to harvest (see "Memory available" above)
— and no nested per-feature run is launched automatically. Once odin's plan is
written, report it to the user — the features it identified, their
resolved `<folder-name>/<system-name>/<phase-name>/` paths, and the
recommended order — and stop. Implementing a given feature in depth is a
separate, later action: the user (or you, on their explicit instruction)
invokes `/factory` or one of the direct-phase commands against that
feature's own path, same as any standalone phase-road request.

### After the system-level plan: confirmation

Once odin's plan is written and reported, ask the user directly whether
the system-level design is complete. Their answer branches:

- **"No, start over"** (the rare case) — this is a full reset. **Before
  re-invoking hermione/sherlock at the system level,** archive the
  existing report files rather than deleting them: move `inquiry-qa.md`,
  every `*-report-human.md` / `*-report-ai.md` pair, and the `plans/`
  folder aside into a timestamped subfolder, e.g.
  `<path>/.archive-<timestamp>/`. This gives askeladd and heimdal a
  genuinely clean slate so they don't mistake leftover files for a
  re-entry. Only after archiving, redo the system level from scratch
  starting at **hermione** (research) and **sherlock** (brainstorm) —
  i.e. re-run the system-level sequence from step 2 onward (research,
  brainstorm, discussion, plan).
- **"No, but let's discuss further"** (the common case) — re-invoke
  **askeladd** at the system level. Do not duplicate its carry-forward
  logic yourself: askeladd will detect the existing
  `discussion-report-ai.md` at the system-level `<path>` on its own and
  handle picking the discussion back up from there (see "the askeladd
  step" above). After askeladd produces its updated discussion report,
  continue the system-level sequence forward from **odin** (the
  system-level plan likely needs to change in light of the further
  discussion), then report the updated plan and ask again.
- **"Yes, complete"** — the workflow-road run is done. Report completion
  to the user and stop. Implementing any feature is a separate run the
  user starts when they're ready.

## How to run each step in practice

For every invocation in this command:

1. State plainly which agent you're about to invoke and why (which phase,
   which road, which path), unless it's Hodor or Aragorn's own invocation
   at the very start of the pipeline.
2. If the step is a skippable phase (anything from Heimdal onward), ask
   the user to confirm before invoking it, and accept "skip this one" as a
   valid answer — if they skip, say so plainly, record the skip (see
   "Recording a skipped phase" below), and move to the next step without
   running the skipped agent.

### Recording a skipped phase

Skipping a phase means that phase's artifact (e.g. `brainstorm-report-ai.md`
if Sherlock was skipped) will never exist at `<path>`. A downstream agent
that goes looking for it and simply finds it missing cannot tell a genuine
gap apart from the user having chosen to skip that phase — treat the two
differently: when you invoke the next agent after a skip, explicitly tell
it, in plain language, which phase(s) were skipped and that the user chose
to skip them (not that something went wrong). Carry that same note forward
to every later agent in the sequence, not just the very next one, since a
report two phases downstream may still need to explain the gap in its own
output. An agent told about a skip should say so plainly in its own
reports ("the brainstorm phase was skipped at the user's request, so this
report proceeds without ranked candidates to compare against") rather than
silently proceeding as if the artifact simply doesn't exist, or erroring
on the missing file.
3. Invoke the agent, carrying forward conversational context (resolved
   path, road, prior reports, anything already decided) rather than making
   the agent re-derive or re-ask for it.
4. When the agent finishes, before invoking the next one, pause again and
   ask the user to confirm moving on — this is the mandatory
   handoff-confirmation this command exists to enforce. Do not chain two
   agent invocations back to back without this pause, except where this
   file explicitly says a pair always runs together without a pause
   (Hodor → Aragorn's own entry, and the trivial-path Hodor → Ullr
   handoff).

## What you must not do

- Do not skip the confirmation pause between any two phases, on either
  road.
- Do not let the user skip Hodor or Aragorn — only phases (Heimdal
  onward) are skippable.
- Do not run L, Gru, L Pass 2, or Mimir as part of a workflow-road
  system-level pass — workflow-road stops after odin's plan;
  implementation only happens in a phase-road run (standalone, or started
  later against one of the identified feature paths), and Mimir is not
  dispatched when there is no implementation to harvest.
- Do not re-implement askeladd's re-entry/carry-forward detection logic in
  this command — just re-invoke askeladd and let it handle it.
- Do not use hermione/odin at the feature level or salander/odysseus at
  the system level — the pairing is fixed by level, not by road name
  alone.
