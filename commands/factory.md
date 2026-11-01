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

## Load the shared rules first

Before anything else, invoke the Skill tool with `skill: "fellowship:pipeline"`. It
holds the shared rules this command refers to by name. If it won't load, tell the
user and stop rather than guessing at them.

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

Then ask the design-complete question, following "After the system-level plan:
design-complete check" in the `fellowship:pipeline` skill.

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
- Do not run salander yourself unless hermione flagged questions or the user asked
  for deep research. Askeladd may call it during the discussion.
