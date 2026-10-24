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
every single handoff, every time, including inside a nested feature run on
workflow-road.

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
Once Ullr finishes, the pipeline is complete. There is nothing to confirm
onward to — report Ullr's result to the user and stop.

## Step 1: invoke Aragorn

Invoke **aragorn**. Aragorn decides phase-road (single feature) vs
workflow-road (whole system) and resolves the folder path:

- Phase-road: `<folder-name>/<phase-name>/`
- Workflow-road: `<folder-name>/<system-name>/`

Aragorn always runs, no confirmation pause before it. Once Aragorn hands
off, you know the road and the resolved `<path>`. Branch:

- **Phase-road** → run the phase-road sequence below once, rooted at
  `<path>` = `<folder-name>/<phase-name>/`.
- **Workflow-road** → run the system-level sequence first, then the
  nested phase-road sequence per feature. See "Workflow-road" below.

## The phase-road sequence (phases 1–8)

This is the core sequence. It runs exactly once for a phase-road request.
On workflow-road it also runs — nested, at a different path — once per
feature identified by the system-level plan (see below). Every step here
is a phase: ask for confirmation after the previous step finishes, before
invoking the next one, and allow "skip this one" for any of them.

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
7. **gru** (implement, dispatches minions via the fellowship:opencode-subagent
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
feature. Take the ordered feature list (and each feature's `<phase-name>`)
directly from the system-level `plan-ai.md`'s explicit ordered feature
list — do not re-derive or re-order it yourself.

**Pass the parent system path down.** When invoking heimdal, salander, or
odysseus for a feature nested under a system, explicitly tell that agent
the parent system path (`<folder-name>/<system-name>/`) alongside the
feature's own nested `<path>`, so it can read the system-level
`plans/plan-ai.md` (and, for salander, also the system-level
`research-report-ai.md`) as upstream context before proceeding, rather
than starting blind.

- These nested feature runs execute **strictly sequentially** — never in
  parallel, never overlapping. Finish one feature's full phase-road run
  (through its own L Pass 2) before starting the next feature's run.
- The confirmation-pause-between-phases behavior described above applies
  **within** each nested phase-road run (you still pause and ask before
  heimdal, before research, before sherlock, and so on, for every
  feature). There is **no extra pause between features** in the
  sequence — once a feature's L Pass 2 finishes, move straight to
  invoking heimdal for the next feature's nested run (still subject to
  the normal per-phase confirm/skip within that run).

### After all nested features finish: system-complete confirmation

Once every feature identified in the system-level plan has completed its
own full nested phase-road run, ask the user directly whether the system
is complete. Their answer branches:

- **"No, start over"** (the rare case) — this is a full reset. **Before
  re-invoking hermione/sherlock at the system level, or re-running any
  feature from heimdal,** archive the existing report files rather than
  deleting them: move `inquiry-qa.md`, every `*-report-human.md` /
  `*-report-ai.md` pair, and the `plans/` folder (at the system level, and
  at each nested feature level that will be redone) aside into a
  timestamped subfolder, e.g. `<path>/.archive-<timestamp>/`. This gives
  askeladd and heimdal a genuinely clean slate so they don't mistake leftover
  files for a re-entry. Only after archiving, redo the system level from
  scratch starting at **hermione** (research) and **sherlock**
  (brainstorm) — i.e. re-run the system-level sequence from step 2 onward
  (research, brainstorm, discussion, plan), and from there, re-run the
  nested per-feature phase-road runs again for whatever the redone
  system-level plan now identifies.
- **"No, but let's discuss further"** (the common case) — re-invoke
  **askeladd** at the system level. Do not duplicate its carry-forward
  logic yourself: askeladd will detect the existing
  `discussion-report-ai.md` at the system-level `<path>` on its own and
  handle picking the discussion back up from there (see "the askeladd
  step" above). After askeladd produces its updated discussion report,
  continue the system-level sequence forward from **odin** (the
  system-level plan likely needs to change in light of the further
  discussion), then re-run the nested per-feature phase-road runs for
  whatever features the updated plan identifies.
- **"Yes, complete"** — the workflow-road run is done. Report completion
  to the user and stop.

## How to run each step in practice

For every invocation in this command:

1. State plainly which agent you're about to invoke and why (which phase,
   which road, which path), unless it's Hodor or Aragorn's own invocation
   at the very start of the pipeline.
2. If the step is a skippable phase (anything from Heimdal onward), ask
   the user to confirm before invoking it, and accept "skip this one" as a
   valid answer — if they skip, say so plainly and move to the next step
   without running the skipped agent.
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
  road, including between nested feature runs' internal phases.
- Do not let the user skip Hodor or Aragorn — only phases (Heimdal
  onward) are skippable.
- Do not run nested feature phase-road runs in parallel — they are
  strictly sequential.
- Do not insert an extra confirmation pause between one feature's
  completion and the next feature's start on workflow-road — the pauses
  belong within each nested run, not between them.
- Do not re-implement askeladd's re-entry/carry-forward detection logic in
  this command — just re-invoke askeladd and let it handle it.
- Do not use hermione/odin at the feature level or salander/odysseus at
  the system level — the pairing is fixed by level, not by road name
  alone.
