# Fellowship — Design Document

## Intent

Fellowship is a Claude Code plugin that turns feature/project requests into a
structured, multi-agent pipeline instead of an ad-hoc single-session build.
Small fixes get routed straight to a fix; real feature work goes through
staged inquiry, research, brainstorming, discussion, and planning before any
code is written; whole-system builds go through the same stages at a higher
level, then break down into individual features that each repeat the cycle.

The core belief driving this: **more structured context up front produces
better implementation decisions**, and that structure should be proportional
to the size of the ask — not applied uniformly to every request regardless
of size.

## Why now

Today, asking Claude Code to "build X" or "add feature Y" collapses straight
into code generation with whatever context fits in the prompt. For anything
beyond a trivial fix, this means assumptions get baked in silently, and the
cost of a wrong assumption is discovered only after implementation. Fellowship
front-loads the expensive-to-change decisions (business intent, actors/scope,
architecture direction, trade-offs) into cheap-to-change documents before any
code exists.

## Goals

- Route every incoming request to the right amount of process: trivial fix,
  single-feature pipeline, or whole-system pipeline — automatically, with a
  human able to override.
- Produce durable, readable artifacts (inquiry report, research report,
  brainstorm report, discussion report, plans) for every non-trivial request,
  stored in a predictable folder structure. Every report comes in two
  versions: a human-readable one (plain language, the "two engineers
  talking" tone) and an AI-readable one (denser, technical, written for the
  next agent in the pipeline to consume) — not a single document trying to
  serve both audiences.
- Let discussion/planning/research stages feel like two engineers talking,
  not like reading an engineering spec back at the user — plain language by
  default, technical depth only on request.
- Support three usage modes: guided step-by-step with confirmation gates,
  direct single-phase invocation, and fully autonomous end-to-end handoff.
- Work against both greenfield builds and existing, multi-year-old codebases
  — inquiry, research, and planning must account for existing architecture,
  conventions, and constraints rather than assuming a blank slate.
- Keep the system prompt load manageable: a fixed roster of agents, not a
  dynamically expanding cast.

## Non-goals

- Not a general-purpose project management tool (no ticket tracking, no
  timelines/calendars).
- Not trying to replace `ecc`'s planning/TDD agents — Fellowship explicitly
  depends on and calls into them rather than reimplementing them.
- Not building a UI; this is a Claude Code plugin (commands + agents +
  skills), text/markdown only.

## Anti-goals (would count as failure even if "it runs")

- A trivial one-line bug fix triggers the full inquiry→research→brainstorm
  pipeline. (Triage must catch this.)
- Reports read like generated boilerplate instead of a real research/
  discussion summary a human would actually read.
- A single report tries to serve both a human reader and the downstream
  agent that consumes it next, and ends up badly serving both.
- Direct phase jump (`/factory-<phase>`) blindly re-runs every upstream
  agent instead of checking for existing artifacts first.
- The plugin assumes greenfield and produces advice that ignores a project's
  existing patterns when run against a mature codebase.

## Constraints

- Must work as a Claude Code plugin: commands, agents, skills only.
- Hard dependency on the `ecc` plugin being installed (used for planning-agent
  patterns and the TDD workflow). A public install script will need to
  provision this.
- Hard dependency on bundling the `opencode-subagent` skill directly inside
  this plugin's repo (not an external dependency) for Gru's minion dispatch.
- Reports/docs may need to be excluded from the host project's git history;
  Fellowship must support per-project gitignore of its working folder.

## Decision layer

Every incoming request passes through a fixed triage chain before any other
agent runs:

1. **Hodor** (triage, Sonnet 5 low) — the only agent that sees every request
   first. Decides: is this trivial (small fix, typo, tiny refactor with no
   behavior change) or does it need the structured process? Not a strict
   rule — for ambiguous cases (e.g. "add a loading spinner to this button"),
   Hodor discusses briefly with the user instead of guessing.
   - On a project's first use, Hodor also asks two setup questions: what
     folder name to use for Fellowship's working docs, and whether that
     folder should be gitignored. The answer is persisted in
     `.fellowship/config.json` (or similar) at the project root; later runs
     read that config instead of re-asking.
2. If trivial → **Ullr** (Sonnet 5 low) takes it directly: investigates the
   existing code and makes the fix. No reports, no further agents.
3. If not trivial → **Aragorn** (Sonnet 5 low) decides, unless the user has
   already said explicitly: **phase-road** (single feature breakdown) vs
   **workflow-road** (whole-system build, which itself decomposes into
   phase-road features later).

## Phases (used by both roads)

Each phase below is itself system-aware or feature-aware — same agent,
aware of which context it's running in, except where noted that the agent is
intentionally split in two (research, planning) because the system-level and
feature-level system prompts diverge enough to be worth separate agents.

1. **Inquiry — Heimdal** (Opus 5, low). Asks staged questions: business
   requirements first, then technical requirements/constraints. The system
   inquiry follows the staged structure in `inquiry-for-system.txt` (problem
   statement → actors/scope → workflows/scenarios → business rules/edge
   cases → data/integration → UI/interaction → non-functional → acceptance
   criteria → review/finalize). Feature inquiry follows the same shape,
   scaled down. Logs the full Q&A (`inquiry-qa.md`, raw transcript, not
   duplicated human/AI) and writes a human report + an AI report
   summarizing it. Must account for existing project context when run
   against a mature codebase (ask about what's already there, not assume
   blank slate).

2. **Research — Hermione (system) / Salander (feature)** (Sonnet 5 low,
   each). Takes the inquiry report, decides what to research (web/deep
   search), researches, then does a brainstorming pass on
   research+inquiry+request to decide if more research is needed.
   - Hermione (system): light brainstorm loop, doesn't go deep since each
     feature gets its own deep research later. Goal: inform system
     architecture (HLD).
   - Salander (feature): deep brainstorm loop, compares pros/cons of options
     in depth. Goal: pick the best low-level design for this specific case.
   - Both write a human report + an AI report.

3. **Brainstorm — Sherlock** (Opus 5, medium). Same agent for both roads.
   Takes request + inquiry reports + research reports, produces ranked
   recommendations, can ask the user follow-up questions if needed. Writes
   a human report + an AI report.

4. **Discussion — Askeladd** (Opus 5, medium). Same agent for both roads.
   A sharp, ruthless-but-constructive debate partner — not a yes-man.
   Interactive discussion of the research/recommendations; ends with a human
   report + an AI report.

   Phases 1–4 above are conversational by design: plain, human language,
   engineering terms only where needed, no codebase-level detail unless the
   user specifically asks a technical question that requires it.

5. **Plans — Odin (system) / Odysseus (feature)** (Sonnet 5 low, each).
   Takes user query + inquiry + research + brainstorm + discussion reports,
   writes the phase/feature breakdown plan. Uses `ecc`'s planning-agent
   patterns. Produces two versions — human-readable and AI-readable — split
   into modular docs under a `plans/` folder if large.

6. **Test — L** (Sonnet 5 low). Writes tests first (TDD, using `ecc`'s
   `tdd-workflow`), confirms coverage of the plan's acceptance criteria.
   Later evaluates the actual implementation against those tests and gives a
   verdict.

7. **Implement — Gru** (Sonnet 5 low). Reads the plan and decides whether
   work can be parallelized across minions or must go step-by-step. Dispatches
   minions via the bundled `opencode-subagent` skill rather than spawning
   plain subagents directly.

8. **Evaluate**: L's verdict + an evaluation report closes out the phase.

## Workflow-road vs phase-road

- **Phase-road** (single feature): phases 1–8 run once, directly under
  `<folder-name>/<phase-name>/`.
- **Workflow-road** (whole system): phases 1–5 run once at the system level
  to produce an overall architecture and phase breakdown
  (`<folder-name>/<system-name>/`), then each identified feature becomes its
  own phase-road run nested under
  `<folder-name>/<system-name>/<phase-name>/`. Workflow-road is for a full
  project/system build start to finish, so nested feature phase-road runs
  execute **sequentially, one after another** — not in parallel and not
  paused for per-feature confirmation (that confirmation granularity belongs
  to `/factory`'s guided mode for a single phase-road invocation, not to the
  workflow-road sequence as a whole).

  After all nested phases finish, the user is asked to confirm the system is
  complete.
  - If "no, start over" (rare): full reset — back to research and
    brainstorm again from scratch.
  - If "no, but let's discuss further" (the common case): Askeladd restarts
    discussion carrying forward the previous `discussion-report.md` as
    input for comparison, rather than starting blind. The prior report is
    superseded in place (overwritten) once the new discussion report is
    written — no versioned filenames.

## Folder structure

A project most often has a single system, but a multi-service project
(e.g. separate backend, frontend, and ML pipeline) can have several
`<system-name>` folders side by side under the same `<folder-name>`, each
going through its own independent workflow-road run.

```
<folder-name>/                        # chosen once per project by Hodor; optionally gitignored
  <system-name>/                      # workflow-road; one of possibly several sibling systems
                                       # (e.g. backend/, frontend/, ml-pipeline/)
    inquiry-qa.md                     # raw Q&A transcript, single file
    inquiry-report-human.md
    inquiry-report-ai.md
    research-report-human.md
    research-report-ai.md
    brainstorm-report-human.md
    brainstorm-report-ai.md
    discussion-report-human.md
    discussion-report-ai.md
    plans/
      plan-human.md
      plan-ai.md
    <phase-name>/                     # each feature under the system
      inquiry-qa.md
      inquiry-report-human.md
      inquiry-report-ai.md
      research-report-human.md
      research-report-ai.md
      brainstorm-report-human.md
      brainstorm-report-ai.md
      discussion-report-human.md
      discussion-report-ai.md
      plans/
        plan-human.md
        plan-ai.md
      implementation-log.md
      test-report.md
      evaluation-report.md

  <phase-name>/                       # phase-road: standalone feature, no system wrapper
    inquiry-qa.md
    inquiry-report-human.md
    inquiry-report-ai.md
    research-report-human.md
    research-report-ai.md
    brainstorm-report-human.md
    brainstorm-report-ai.md
    discussion-report-human.md
    discussion-report-ai.md
    plans/
      plan-human.md
      plan-ai.md
    implementation-log.md
    test-report.md
    evaluation-report.md
```

`<phase-name>` is the actual feature's name (e.g. `dark-mode-toggle`), not
the literal word "phase".

## Usage modes (commands)

Three coexisting entry points:

1. **`/factory`** — guided mode. Starts at Hodor, then hands off agent to
   agent through the pipeline, pausing for user confirmation before each
   handoff. A step can be skipped on confirmation if it's judged unnecessary
   for this request.
2. **`/factory-<phase>`** (e.g. `/factory-research`, `/factory-discussion`)
   — direct single-phase invocation. Before running, the invoked agent
   checks whether its required upstream artifact(s) already exist in the
   target folder; if present, it uses them as-is instead of re-triggering
   the upstream agent. Only triggers upstream agents for genuinely missing
   artifacts.
3. **`/factory-auto`** — fully autonomous agent-to-agent handoff, no
   confirmation pauses.

## Agent roster and model/effort

| Agent | Phase | Model / effort |
|---|---|---|
| Hodor | Triage | Sonnet 5, low |
| Ullr | Trivial fix | Sonnet 5, low |
| Aragorn | Routing (phase vs workflow) | Sonnet 5, low |
| Heimdal | Inquiry | Opus 5, low |
| Hermione | Research (system) | Sonnet 5, low |
| Salander | Research (feature) | Sonnet 5, low |
| Sherlock | Brainstorm | Opus 5, medium |
| Askeladd | Discussion | Opus 5, medium |
| Odin | Plans (system) | Sonnet 5, low |
| Odysseus | Plans (feature) | Sonnet 5, low |
| L | Test (write + evaluate) | Sonnet 5, low |
| Gru | Implement (dispatches minions) | Sonnet 5, low |
| Minions (via `opencode-subagent`) | Implement workers | per that skill's config |

## What's left to the builder

- Exact prompt wording/personas for each agent (tone: human, not a spec
  document — this is called out as a requirement but phrasing itself is an
  implementation detail).
- Exact schema of `.fellowship/config.json` (folder name, gitignore flag,
  any other persisted project-level settings).
- Exact mechanism for "existing artifact" detection before an agent re-runs
  an upstream phase. For v1, this is a plain file-existence check only;
  staleness/freshness detection (e.g. code changed since the report was
  written) is explicitly deferred past v1.
- Hodor and Aragorn share conversational context within the same session
  rather than each re-reading the raw request cold from disk, so Aragorn
  doesn't re-ask what Hodor already resolved (first-use setup, existing-
  project context) and the two decisions stay consistent.
- Hodor's "discuss briefly with the user" for ambiguous trivial/non-trivial
  cases is plain conversational back-and-forth, not a structured
  question-and-options UI.
- Public install script that provisions the `ecc` plugin dependency when
  Fellowship is released — not needed for the current single-user setup
  where `ecc` is already installed.
- Whether Gru's parallel-vs-sequential decision and minion task splitting
  needs any additional structure beyond "read the plan and judge" — left to
  the builder to refine once the plan format (from Odin/Odysseus) is final.
