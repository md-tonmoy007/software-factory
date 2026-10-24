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
user anything mid-pipeline, including inside a nested feature run on
workflow-road. The one exception is the system-complete confirmation at
the very end of a workflow-road run (see "After all nested features
finish" below) — that is not a pause between phases, it is the terminal
check the design mandates after all features finish, and it still happens.

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
request itself). Once Ullr finishes, the pipeline is complete. There is
nothing to confirm onward to — report Ullr's result to the user and stop.

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
- **Workflow-road** → run the system-level sequence first, then the
  nested phase-road sequence per feature. See "Workflow-road" below.

## The phase-road sequence (phases 1–8)

This is the core sequence. It runs exactly once for a phase-road request.
On workflow-road it also runs — nested, at a different path — once per
feature identified by the system-level plan (see below). Every step here
proceeds immediately into the next with no pause and no skip option.

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

   **Only continue to steps 6–8 below when this sequence is a phase-road
   run that actually implements something** — i.e. plain phase-road, or a
   nested per-feature run under workflow-road. When this sequence is
   workflow-road's own system-level pass (steps 1–5 at the system level,
   producing the architecture/phase breakdown), stop after odin's plan and
   go to "Workflow-road" below instead — there is no system-level
   implementation step; implementation happens per feature.

6. **l** (Pass 1: writes tests against the plan).
7. **gru** (implement, dispatches minions via the opencode-subagent
   skill) — writes `<path>/implementation-log.md`.
8. **l** (Pass 2: evaluates Gru's implementation) — writes
   `<path>/test-report.md`.

After step 8, the phase-road sequence for this `<path>` is complete.

## Workflow-road

Workflow-road runs the phase-road sequence's steps 1–5 **once at the
system level**, under `<path>` = `<folder-name>/<system-name>/`, using
**hermione** (not salander) and **odin** (not odysseus) for steps 2 and 5.
This produces the overall architecture / phase breakdown plan
(`<path>/plans/plan-human.md`, `<path>/plans/plan-ai.md`), identifying the
individual features the system decomposes into.

Then, for **each feature** identified in that system-level plan, run the
**full** phase-road sequence (all 8 steps, using salander and odysseus for
steps 2 and 5) nested under
`<folder-name>/<system-name>/<phase-name>/` — one `<phase-name>` per
feature.

- These nested feature runs execute **strictly sequentially** — never in
  parallel, never overlapping. Finish one feature's full phase-road run
  (through its own L Pass 2) before starting the next feature's run.
- There is no pause anywhere in this mode — not within a nested run, not
  between one feature's completion and the next feature's start. Once a
  feature's L Pass 2 finishes, move straight to invoking heimdal for the
  next feature's nested run.

### After all nested features finish: system-complete confirmation

Once every feature identified in the system-level plan has completed its
own full nested phase-road run, ask the user directly whether the system
is complete. This is the one point in this command where you stop and ask
— it is the terminal check the design mandates after all features finish,
not a pause between phases. Their answer branches:

- **"No, start over"** (the rare case) — this is a full reset. Go back to
  the system level and redo it from scratch starting at **hermione**
  (research) and **sherlock** (brainstorm) — i.e. re-run the system-level
  sequence from step 2 onward (research, brainstorm, discussion, plan),
  and from there, re-run the nested per-feature phase-road runs again for
  whatever the redone system-level plan now identifies. Once the user has
  answered, the rest of this proceeds immediately with no further pauses.
- **"No, but let's discuss further"** (the common case) — re-invoke
  **askeladd** at the system level immediately. Do not duplicate its
  carry-forward logic yourself: askeladd will detect the existing
  `discussion-report-ai.md` at the system-level `<path>` on its own and
  handle picking the discussion back up from there (see "the askeladd
  step" above). After askeladd produces its updated discussion report,
  continue the system-level sequence forward from **odin** (the
  system-level plan likely needs to change in light of the further
  discussion), then re-run the nested per-feature phase-road runs for
  whatever the updated plan identifies — all with no further pauses.
- **"Yes, complete"** — the workflow-road run is done. Report completion
  to the user and stop.

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
   anything is the system-complete confirmation after all of
   workflow-road's nested feature runs have finished — every other
   handoff proceeds immediately.

## What you must not do

- Do not pause for confirmation between any two phases, on either road,
  including between nested feature runs' internal phases, and including
  between one feature's completion and the next feature's start.
- Do not offer the user a skip option for any phase — every phase always
  runs in this mode.
- Do not run nested feature phase-road runs in parallel — they are
  strictly sequential.
- Do not re-implement askeladd's re-entry/carry-forward detection logic in
  this command — just re-invoke askeladd and let it handle it.
- Do not use hermione/odin at the feature level or salander/odysseus at
  the system level — the pairing is fixed by level, not by road name
  alone.
- Do not skip the system-complete confirmation at the end of a
  workflow-road run — it is a design-mandated terminal check, not a
  between-phase pause, and this command still performs it.
