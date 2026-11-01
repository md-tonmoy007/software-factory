---
description: Most hands-off entry point for the Fellowship pipeline. Same lanes as /factory, but only Heimdal asks you anything; Askeladd decides on its own instead of debating you.
---

# /factory-auto — autonomous mode

You are driving the Fellowship pipeline for the request the user just gave
you (or is about to give you, if they invoked `/factory-auto` with no
argument — in that case, ask what they want done before doing anything
else).

This runs the same lanes as `/factory`, with one difference: **Askeladd does
not stop to debate the user.** When dispatching askeladd in this mode, tell it
explicitly that it is running under `/factory-auto`. It still ranks the
candidates and argues against its own top pick, then adopts the surviving top
candidate and says in its reports that the user has not confirmed it. Tell
**odin** and **odysseus** too, so they say so if they consult Askeladd.

## Where the user is stopped

- **Heimdal (inquiry)** — the one planned stop, because the pipeline cannot
  reasonably guess what the user wants.
- **Workflow-road's design-complete check** after Odin's plan.
- **Exception stops** — the same list as `/factory`: L's verdict still
  `VERDICT: FAIL` after two repair rounds, Gru's closing message starting with
  `BLOCKED:`, an agent's closing message starting with `REOPEN:`, or something
  destructive or hard to reverse that the plan didn't call for.

Never add any other pause. There is no per-phase skip prompt.

## Shared mechanisms

This command follows the sections defined once in `commands/factory.md`, rather
than restating them: "User-input relay protocol" (for Heimdal), "Code-exploration
relay", "Peer consultation", "Memory available", "Research step", "Repair
loop", and
"Resuming an already-resolved path" with its folder-detection rules.

## Step 0: invoke Hodor

Hand the user's request to **hodor**. It handles project setup, picks the lane,
resolves `<path>`, and never asks the user anything. Branch on its verdict
immediately.

## The trivial path

Invoke **ullr**. If its closing message starts with `NOT TRIVIAL:`, say so in one
line, invoke **hodor** again telling it the request is small, and continue at
"The small lane", passing Ullr's findings to Heimdal. Otherwise, run the Mimir
screen, report Ullr's result, and stop.

## The small lane

1. **heimdal** (short inquiry, tell it this is the small lane) — writes
   `<path>/inquiry-qa.md` and `<path>/inquiry-report-ai.md`, which starts with
   `Lane: small`. If its report starts with `Lane: feature` instead, continue at
   "The feature lane" from step 2.
2. **l** (Pass 1: writes tests against the inquiry report's acceptance criteria).
3. **gru** (implement, dispatches minions via the fellowship:opencode-subagent
   skill) — writes `<path>/implementation-log.md`.
4. **l** (Pass 2) — appends its verdict to `<path>/test-report.md` and writes
   `<path>/evaluation-report.md`. Follow the "Repair loop".
5. Run the Mimir screen, report the outcome, and stop.

## The feature lane

1. **heimdal** (inquiry, feature-level) — writes `<path>/inquiry-qa.md`,
   `<path>/inquiry-report-ai.md`, and `<path>/inquiry-report-human.md`.
2. **Research step, feature level** — hermione, then salander only if flagged.
3. **askeladd** (decision, under `/factory-auto`) — writes
   `<path>/discussion-report-ai.md` and `<path>/discussion-report-human.md`.
4. **odysseus** (plan, feature-level) — writes `<path>/plans/plan-ai.md`.
5. **l** (Pass 1: writes tests against the plan).
6. **gru** (implement, dispatches minions via the fellowship:opencode-subagent
   skill) — writes `<path>/implementation-log.md`.
7. **l** (Pass 2) — appends its verdict to `<path>/test-report.md` and writes
   `<path>/evaluation-report.md`. Follow the "Repair loop".
8. Run the Mimir screen and report the outcome, flagging that the design decision
   was made without the user. Then stop.

If this feature is nested under a system, pass the parent system path to heimdal,
hermione, salander, and odysseus.

## Workflow-road

Runs once, at the system level only, under `<path>` =
`<folder-name>/<system-name>/`:

1. **heimdal** (inquiry, system-level).
2. **Research step, system level** — hermione, then salander only if flagged.
3. **askeladd** (decision, under `/factory-auto`).
4. **odin** (plan, system-level) — writes `<path>/plans/plan-ai.md` and
   `<path>/plans/plan-human.md`.

**Workflow-road stops there**, even in this mode. It never runs L, Gru, or Mimir,
and no feature run is launched automatically. Report the features Odin identified,
their resolved `<folder-name>/<system-name>/<phase-name>/` paths, and the
recommended order.

### After the system-level plan: design-complete check

Ask the user whether the system-level design is complete, and follow the same
branches as "After the system-level plan: design-complete check" in
`commands/factory.md`: "No, start over" archives the reports and restarts from
Heimdal; "No, but let's discuss further" re-invokes askeladd **without** the
`/factory-auto` instruction, because the user is asking to talk, then re-runs Odin
and asks again; "Yes, complete" ends the run.

## How to run each step in practice

Say in one line which agent you're starting and why, then invoke it immediately,
carrying forward conversational context (resolved path, road, lane, prior reports,
anything already decided). When it finishes, move straight to the next step.

## What you must not do

- Do not add stops beyond the ones listed above.
- Do not run L, Gru, or Mimir as part of a workflow-road system-level pass.
- Do not report a run as complete while the verdict is `VERDICT: FAIL` or Gru is
  blocked.
- Do not re-implement askeladd's re-entry/carry-forward detection logic in this
  command — just re-invoke askeladd and let it handle it.
- Do not use odin at the feature level or odysseus at the system level.
- Do not run salander unless hermione flagged questions or the user asked for deep
  research.
