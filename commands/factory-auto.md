---
description: Fully autonomous entry point for the Fellowship pipeline. Drives the whole agent sequence end to end with no pause for confirmation between handoffs.
---

# /factory-auto — fully autonomous mode

You are driving the Fellowship pipeline for the request the user just gave
you (or is about to give you, if they invoked `/factory-auto` with no
argument — in that case, ask what they want done before doing anything
else).

This command is the **fully autonomous** entry point: every agent in the
sequence below hands off straight to the next one with **no pause** for
user confirmation and **no per-phase skip option**. This is autonomy, not
guidance — the whole pipeline runs end to end without stopping to ask the
user anything mid-pipeline. The one exception is the design-complete
confirmation at the end of a workflow-road run (see "After the
system-level plan" below) — that is not a pause between phases, it is the
terminal check the design mandates once the system-level plan is written,
and it still happens.

## User-input relay protocol

Hodor, aragorn, heimdal, sherlock, and askeladd are interactive agents
dispatched as subagents; they cannot hold a live back-and-forth with the
user on their own. This command follows the same "User-input relay
protocol" and the same "Resuming an already-resolved path" / system-level
detection rule defined once in `commands/factory.md` — see those sections
there rather than this file restating them. In short: if a dispatched
agent returns question(s) instead of a final report, relay them to the
user, get the answer, and resume the same agent (not a fresh dispatch)
until it produces its final report.

Separately, any phase agent may also need **code-explorer** dispatched for
grounded, file-level facts about existing code — follow the
"Code-exploration relay" mechanism defined once in `commands/factory.md`.
This is not a user-facing question, so it applies in auto mode the same way
it does in guided mode, for every phase, with no restriction like the one
below.

Any phase agent may also discover a gap in a different agent's domain —
follow the "Peer consultation relay" mechanism defined once in
`commands/factory.md`. A quick consult (step 2 of that mechanism) is not a
user-facing question either, so it proceeds in auto mode the same way.
**Reopening a phase (step 3) still requires pausing to ask the user**, even
in auto mode — auto mode's no-pause rule is about routine phase hand-offs,
not about silently redoing an earlier phase's work on an agent's own say-so.

**Only heimdal may use this relay in auto mode.** Autonomous means no
pause for the user mid-pipeline, so **heimdal (inquiry) is the only step
in this mode allowed to ask the user anything** — inquiry is the one phase
where the pipeline cannot reasonably guess what the user wants, so it gets
a real exchange. Every other interactive agent (hodor, aragorn, sherlock,
askeladd) must proceed without asking the user anything: when dispatching
them in this mode, explicitly tell each one it is running under
`/factory-auto` and must make its own best call on anything it would
otherwise ask about, rather than returning a question. **Askeladd
specifically must skip its own interactive debate entirely in this mode:**
instead of debating with the user, adopt sherlock's top-ranked brainstorm
recommendation directly as the discussion's outcome, and write both
discussion reports noting plainly that the interactive debate was skipped
under auto mode and the result reflects brainstorm's top recommendation
as-is.

## Which steps always run

Every step below always runs — Hodor, Aragorn, and every phase from
Heimdal onward. There is no skip option for any of them in this mode.

## Step 0: invoke Hodor

Hand the user's request to **hodor**. Hodor handles first-run
`.fellowship/config.json` setup if needed, then triages the request as
trivial or non-trivial.

- No pause before Hodor — it is the entry point, it always runs first.
- When Hodor finishes, branch on its verdict immediately, with no pause:
  - **Trivial** → go to "Trivial path" below. Done, no further phases.
  - **Non-trivial** → go straight to Step 1 (Aragorn). No pause between
    Hodor and Aragorn.

## Trivial path

Invoke **ullr** immediately to make the direct fix, carrying forward
whatever Hodor already resolved conversationally (config values, the
request itself). Once Ullr finishes, invoke **mimir** immediately (see
"Memory available" in `commands/factory.md`) to harvest a wiki entry from
Ullr's report if the write gate warrants one. Once Mimir finishes, the
pipeline is complete — report both Ullr's result and Mimir's
write-or-suppress outcome to the user and stop.

## Step 1: invoke Aragorn

Invoke **aragorn** immediately, with no pause. Aragorn decides phase-road
(single feature) vs workflow-road (whole system) and resolves the folder
path:

- Phase-road: `<folder-name>/<phase-name>/`
- Workflow-road: `<folder-name>/<system-name>/`

Once Aragorn hands off, you know the road and the resolved `<path>`.
Branch immediately, with no pause:

- **Phase-road** → run the phase-road sequence below once, rooted at
  `<path>` = `<folder-name>/<phase-name>/`.
- **Workflow-road** → run the system-level sequence only. See
  "Workflow-road" below. Implementing any individual feature happens
  later, as its own separate phase-road run.

## The phase-road sequence (phases 1–8)

This is the core sequence. It runs exactly once for a phase-road request,
or once for workflow-road's own system-level pass (steps 1–5 only — see
"Workflow-road" below). It also runs, independently and later, whenever a
fresh phase-road request is started rooted at one of the feature paths a
system-level plan identified. Every step here proceeds immediately into
the next with no pause and no skip option.

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
9. **mimir** — runs terminally, immediately, with no pause (see "Memory
   available" in `commands/factory.md`), harvesting from
   `implementation-log.md`, `test-report.md`, and `evaluation-report.md`.

After step 9, the phase-road sequence for this `<path>` is complete.

## Workflow-road

Workflow-road runs the phase-road sequence's steps 1–5 **once, at the
system level only**, under `<path>` = `<folder-name>/<system-name>/`,
using **hermione** (not salander) and **odin** (not odysseus) for steps 2
and 5. This produces the overall architecture / high-level design and
phase breakdown plan (`<path>/plans/plan-human.md`,
`<path>/plans/plan-ai.md`), identifying the individual features the
system decomposes into — their names, scope, and dependency order.

**Workflow-road stops there**, even in this autonomous mode. It does not
go deep into any individual feature, and it does not run the phase-road
sequence per feature itself. Steps 6–9 never run at the system level —
Mimir is not dispatched, since no implementation occurred and there is
nothing to harvest — and no feature run is launched automatically. Once odin's plan is written,
report it to the user — the features it identified, their resolved
`<folder-name>/<system-name>/<phase-name>/` paths, and the recommended
order — then go to "After the system-level plan" below.

### After the system-level plan: design-complete confirmation

Once odin's plan is written and reported, ask the user directly whether
the system-level design is complete. This is the one point in this
command where you stop and ask — it is the terminal check the design
mandates once the system-level plan exists, not a pause between phases.
Their answer branches:

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
  brainstorm, discussion, plan). Once the user has answered, the rest of
  this proceeds immediately with no further pauses.
- **"No, but let's discuss further"** (the common case) — re-invoke
  **askeladd** at the system level immediately. Do not duplicate its
  carry-forward logic yourself: askeladd will detect the existing
  `discussion-report-ai.md` at the system-level `<path>` on its own and
  handle picking the discussion back up from there (see "the askeladd
  step" above). After askeladd produces its updated discussion report,
  continue the system-level sequence forward from **odin** (the
  system-level plan likely needs to change in light of the further
  discussion), then report the updated plan and ask again — all with no
  further pauses in between.
- **"Yes, complete"** — the workflow-road run is done. Report completion
  to the user and stop. Implementing any feature is a separate run
  started later.

## How to run each step in practice

For every invocation in this command:

1. State plainly which agent you're about to invoke and why (which phase,
   which road, which path), unless it's Hodor or Aragorn's own invocation
   at the very start of the pipeline.
2. Invoke the agent immediately — no confirmation pause, no skip option,
   for any step, on either road. Carry forward conversational context
   (resolved path, road, prior reports, anything already decided) rather
   than making the agent re-derive or re-ask for it.
3. When the agent finishes, move straight to the next step with no pause.
   The only point in this entire command where you stop and ask the user
   anything is the design-complete confirmation after workflow-road's
   system-level plan is written — every other handoff proceeds
   immediately.

## What you must not do

- Do not pause for confirmation between any two phases, on either road.
- Do not offer the user a skip option for any phase — every phase always
  runs in this mode.
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
- Do not skip the design-complete confirmation at the end of a
  workflow-road run — it is a design-mandated terminal check, not a
  between-phase pause, and this command still performs it.
