# Fellowship Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fellowship Claude Code plugin — a fixed-roster multi-agent
pipeline (triage → inquiry → research → brainstorm → discussion → plans →
test → implement) exposed through three slash-command entry points, with its
own config file, folder-structure conventions, and a vendored
`opencode-subagent` skill for Gru's minion dispatch.

**Architecture:** A standard Claude Code plugin (`.claude-plugin/plugin.json`
+ `agents/` + `commands/` + `skills/`). Each pipeline role is one agent
markdown file (frontmatter: name, description, tools, model). Three command
files (`factory.md`, `factory-auto.md`, and one `factory-<phase>.md` per
phase) drive agent-to-agent handoff at different levels of human-in-the-loop
confirmation. No application code, no runtime/build step — "testing" here
means structural validation (frontmatter present and well-formed, commands
reference real agents, config schema documented) via small shell checks, not
unit tests against business logic.

**Tech Stack:** Markdown + YAML frontmatter (Claude Code plugin format), one
vendored skill directory, bash for validation scripts.

**Spec:** `docs/superpowers/specs/2026-10-24-fellowship-design.md`

## Global Constraints

- Plugin must work as commands + agents + skills only (design: Constraints).
- Hard dependency on the `ecc` plugin already being installed (design:
  Constraints) — agents that reference `ecc` patterns (Odin, Odysseus, L)
  must name the exact `ecc` skill/agent they call into, not a paraphrase.
- `opencode-subagent` skill must be vendored inside this plugin's own repo,
  not referenced as an external plugin dependency (design: Constraints).
- Fellowship's working folder must be supportable as gitignored per-project
  (design: Constraints, Decision layer item 1).
- Fixed roster of exactly 12 named agents — no dynamically generated agents
  (design: Goals, "keep the system prompt load manageable").
- Every report-producing phase (inquiry, research, brainstorm, discussion)
  writes a `-human.md` and `-ai.md` pair; `inquiry-qa.md` stays a single raw
  transcript; `plans/` is the one subfolder, holding `plan-human.md` /
  `plan-ai.md` (design: Goals, Folder structure).
- Folder structure, including multi-system sibling support, must match the
  exact tree in the spec's "Folder structure" section verbatim.
- Phases 1–4 (inquiry, research, brainstorm, discussion) must read and write
  in plain conversational language by default; technical depth only on
  request (design: Phases, note after item 4).
- Workflow-road nested feature phase-road runs execute strictly sequentially,
  no parallelism, no per-feature confirmation pause (design: Workflow-road
  vs phase-road).
- `/factory-<phase>` must check for existing upstream artifacts (file
  existence only, v1) before re-triggering an upstream agent (design:
  Usage modes item 2; What's left to the builder).
- Model/effort per agent must exactly match the roster table (design: Agent
  roster and model/effort) — this is not a per-task judgment call.

## Review Focus

- **Ambiguous trivial/non-trivial request** (e.g. "add a loading spinner to
  this button"): Hodor must discuss with the user in plain conversation
  rather than silently picking a lane. Covered in Task 2.
- **First run on a project vs. Nth run**: Hodor must ask the folder-name/
  gitignore questions only when `.fellowship/config.json` is absent, and
  must reuse stored config otherwise — a project re-run that re-asks setup
  questions is a bug. Covered in Task 2.
- **Direct phase invocation with artifacts already present**
  (`/factory-research` when `inquiry-report-ai.md` already exists): the
  invoked agent must use the existing file, not re-run Heimdal. Covered in
  Task 13.
- **Direct phase invocation with a missing upstream artifact**: the invoked
  agent must trigger only the missing upstream agent(s), not the whole
  chain from Hodor. Covered in Task 13.
- **Existing multi-year-old codebase (brownfield) run**: Heimdal, Hermione/
  Salander, and Odin/Odysseus prompts must explicitly instruct the agent to
  inspect existing code/conventions before asking questions or proposing
  design, rather than assuming greenfield. Covered in Tasks 5, 6, 9.

---

## File Structure

```
.claude-plugin/
  plugin.json                     # plugin manifest: name, commands, agents list

agents/
  hodor.md                        # triage
  ullr.md                         # trivial fix
  aragorn.md                      # phase-road vs workflow-road routing
  heimdal.md                      # inquiry
  hermione.md                     # research (system)
  salander.md                     # research (feature)
  sherlock.md                     # brainstorm
  askeladd.md                     # discussion
  odin.md                         # plans (system)
  odysseus.md                     # plans (feature)
  l.md                            # test write + evaluate
  gru.md                          # implement (dispatches minions)

commands/
  factory.md                      # guided mode: Hodor -> ... with confirmation gates
  factory-inquiry.md
  factory-research.md
  factory-brainstorm.md
  factory-discussion.md
  factory-plans.md
  factory-test.md
  factory-implement.md
  factory-auto.md                 # fully autonomous handoff, no pauses

skills/
  opencode-subagent/               # vendored copy, used by Gru
    SKILL.md
    ... (vendored supporting files, copied verbatim)

scripts/
  validate-agent-frontmatter.sh    # shared validation check used by every agent task
  validate-plugin.sh               # final smoke check: manifest lists every agent/command
```

Each agent file is one clear responsibility (one role in the pipeline).
Commands are thin: they describe the handoff sequence and confirmation
behavior, and reference agents by name — they do not duplicate agent
prompt content.

---

### Task 1: Plugin scaffold and manifest

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `scripts/validate-agent-frontmatter.sh`
- Create: `scripts/validate-plugin.sh`

**Interfaces:**
- Produces: `scripts/validate-agent-frontmatter.sh <path-to-agent-md>` — exits
  0 if the file has YAML frontmatter with non-empty `name`, `description`,
  `model`, and `tools` keys; exits 1 and prints the missing key otherwise.
  Every later agent task uses this script as its verification step.
- Produces: `scripts/validate-plugin.sh` — exits 0 if every file listed in
  `plugin.json`'s `agents` and `commands` arrays exists on disk; exits 1 and
  prints the missing path otherwise. Used as the final plan-wide check.

- [ ] **Step 1: Write `scripts/validate-agent-frontmatter.sh`**

Takes one argument (a file path). Extracts the YAML frontmatter block
(between the first two `---` lines) and checks for `name:`, `description:`,
`model:`, and `tools:` keys with non-empty values. Exit 0/1 as above with a
one-line message to stderr on failure.

- [ ] **Step 2: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "fellowship",
  "version": "0.1.0",
  "description": "Turns incoming requests into a sized multi-agent pipeline: trivial fix, single-feature phase-road, or whole-system workflow-road.",
  "agents": [
    "agents/hodor.md",
    "agents/ullr.md",
    "agents/aragorn.md",
    "agents/heimdal.md",
    "agents/hermione.md",
    "agents/salander.md",
    "agents/sherlock.md",
    "agents/askeladd.md",
    "agents/odin.md",
    "agents/odysseus.md",
    "agents/l.md",
    "agents/gru.md"
  ],
  "commands": [
    "commands/factory.md",
    "commands/factory-inquiry.md",
    "commands/factory-research.md",
    "commands/factory-brainstorm.md",
    "commands/factory-discussion.md",
    "commands/factory-plans.md",
    "commands/factory-test.md",
    "commands/factory-implement.md",
    "commands/factory-auto.md"
  ],
  "skills": [
    "skills/opencode-subagent"
  ]
}
```

- [ ] **Step 3: Write `scripts/validate-plugin.sh`**

Reads `.claude-plugin/plugin.json` with `jq` (or a portable grep/sed
fallback if `jq` is unavailable), checks every path in `agents`, `commands`,
and `skills` exists relative to the repo root. Exit 0/1 with missing paths
listed on failure.

- [ ] **Step 4: Run `bash scripts/validate-plugin.sh`**

Expected: FAIL (agents/commands don't exist yet) — this confirms the script
actually checks presence rather than vacuously passing.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json scripts/validate-agent-frontmatter.sh scripts/validate-plugin.sh
git commit -m "feat: scaffold fellowship plugin manifest and validation scripts"
```

---

### Task 2: Hodor (triage) and the config schema

**Files:**
- Create: `agents/hodor.md`

**Interfaces:**
- Produces: `.fellowship/config.json` schema — `{"folderName": string,
  "gitignore": boolean}`, written by Hodor on a project's first run, read by
  Hodor (and shared with Aragorn in-session) on every later run.
- Consumes: none (first agent in the chain).
- Produces (for Aragorn): the triage verdict — "trivial" (hands off to
  Ullr) or "non-trivial" (hands off to Aragorn) — plus the already-resolved
  first-use setup context, passed along conversationally rather than
  re-read from disk.

- [ ] **Step 1: Write `agents/hodor.md` frontmatter**

```yaml
---
name: hodor
description: Triage gate for every incoming Fellowship request. Decides trivial (routes to Ullr) vs non-trivial (routes to Aragorn). Handles first-run project setup (.fellowship/config.json).
model: claude-sonnet-5
tools: Read, Write, Grep, Glob, Bash
---
```

- [ ] **Step 2: Write Hodor's body**

Must specify, as exact behavior (not left to the implementer's judgment):
1. On invocation, check for `.fellowship/config.json` at the project root.
   If absent, ask the user for a folder name and whether to gitignore it,
   then write the file with the schema above, and add the folder to
   `.gitignore` if requested.
2. If present, read and reuse it silently (no re-asking).
3. Classify the request as trivial or non-trivial. For a genuinely
   ambiguous case (example from spec: "add a loading spinner to this
   button"), discuss briefly in plain conversation with the user instead of
   guessing — this is a real back-and-forth, not a menu of options.
4. State the verdict explicitly at the end ("trivial — handing to Ullr" /
   "non-trivial — handing to Aragorn") and share the resolved config/
   first-use context forward so Aragorn doesn't re-ask it.
5. Tone: plain, conversational, no spec-document phrasing.

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/hodor.md`**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/hodor.md
git commit -m "feat: add Hodor triage agent and .fellowship/config.json setup flow"
```

---

### Task 3: Ullr (trivial fix)

**Files:**
- Create: `agents/ullr.md`

**Interfaces:**
- Consumes: Hodor's "trivial" verdict and the original request (conversational handoff, no file artifact).
- Produces: a direct code fix. No reports, no further agent handoff (design: Decision layer item 2).

- [ ] **Step 1: Write `agents/ullr.md` frontmatter**

```yaml
---
name: ullr
description: Takes a Hodor-triaged trivial request (small fix, typo, tiny refactor with no behavior change) and fixes it directly, investigating the existing code first. No reports, no further handoff.
model: claude-sonnet-5
tools: Read, Write, Edit, Grep, Glob, Bash
---
```

- [ ] **Step 2: Write Ullr's body**

Must specify: investigate the existing code relevant to the request before
editing (works on both greenfield and multi-year-old codebases per design
Goals); make the fix directly; do not write inquiry/research/brainstorm/
discussion artifacts; do not hand off to any other Fellowship agent when done.

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/ullr.md`**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/ullr.md
git commit -m "feat: add Ullr trivial-fix agent"
```

---

### Task 4: Aragorn (phase-road vs workflow-road routing)

**Files:**
- Create: `agents/aragorn.md`

**Interfaces:**
- Consumes: Hodor's "non-trivial" verdict plus shared session context (no re-read from disk — design: What's left to the builder).
- Produces: a road decision — "phase-road" (hands off to Heimdal under `<folder-name>/<phase-name>/`) or "workflow-road" (hands off to Heimdal under `<folder-name>/<system-name>/`) — unless the user has already stated the road explicitly, in which case Aragorn skips straight to confirming the folder path.

- [ ] **Step 1: Write `agents/aragorn.md` frontmatter**

```yaml
---
name: aragorn
description: Decides phase-road (single feature) vs workflow-road (whole system) for a non-trivial request Hodor has already triaged, unless the user already stated which. Hands off to Heimdal with the resolved folder path.
model: claude-sonnet-5
tools: Read, Grep, Glob
---
```

- [ ] **Step 2: Write Aragorn's body**

Must specify: read the shared session context from Hodor (not a fresh disk
read); if the user already explicitly said "phase" or "workflow"/"whole
system", skip the question and just resolve the folder path; otherwise ask
a short clarifying question distinguishing "one feature" from "whole system/
project build start to finish"; on decision, state the resolved path
(`<folder-name>/<phase-name>/` or `<folder-name>/<system-name>/`) and hand
off to Heimdal.

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/aragorn.md`**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/aragorn.md
git commit -m "feat: add Aragorn phase-road/workflow-road routing agent"
```

---

### Task 5: Heimdal (inquiry)

**Files:**
- Create: `agents/heimdal.md`

**Interfaces:**
- Consumes: resolved folder path and road type from Aragorn; the original request.
- Produces: `<path>/inquiry-qa.md` (raw Q&A transcript, single file), `<path>/inquiry-report-human.md`, `<path>/inquiry-report-ai.md`. `<path>` is `<folder-name>/<phase-name>/` or `<folder-name>/<system-name>/` depending on road.

- [ ] **Step 1: Write `agents/heimdal.md` frontmatter**

```yaml
---
name: heimdal
description: Inquiry phase. Asks staged business-then-technical questions (system-level uses inquiry-for-system.txt's 9-stage structure; feature-level is the same shape, scaled down). Writes inquiry-qa.md plus a human and an AI inquiry report.
model: claude-opus-5
tools: Read, Write, Grep, Glob
---
```

- [ ] **Step 2: Write Heimdal's body**

Must specify: business requirements before technical; system-level inquiry
follows the exact 9-stage order from `inquiry-for-system.txt` (problem
statement → actors/permissions/scope → workflows/scenarios → business
rules/edge cases → data/integration → UI/interaction → non-functional →
acceptance criteria → review/finalize); feature-level inquiry is the same
shape scaled down for one feature; when run against an existing codebase,
ask what's already there instead of assuming blank slate; log every Q&A
turn verbatim to `inquiry-qa.md`; at the end, write
`inquiry-report-human.md` (plain language) and `inquiry-report-ai.md`
(denser, technical) as two independent documents, not a shared one.

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/heimdal.md`**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/heimdal.md
git commit -m "feat: add Heimdal inquiry agent"
```

---

### Task 6: Hermione (system research) and Salander (feature research)

**Files:**
- Create: `agents/hermione.md`
- Create: `agents/salander.md`

**Interfaces:**
- Consumes (both): the inquiry report pair from Heimdal, the original request.
- Produces (both): `<path>/research-report-human.md`, `<path>/research-report-ai.md`.

- [ ] **Step 1: Write `agents/hermione.md` frontmatter and body**

```yaml
---
name: hermione
description: System-level research. Takes the inquiry report, researches what's needed to inform overall architecture (HLD), runs a light brainstorm loop (shallow — each feature gets its own deep research later) to decide if more research is needed. Writes a human and an AI research report.
model: claude-sonnet-5
tools: Read, Write, Grep, Glob, WebSearch, WebFetch
---
```

Body must specify: light/shallow brainstorm-to-decide-more-research loop
(not deep comparison); goal is informing system architecture, not picking a
final low-level design; writes both report files.

- [ ] **Step 2: Write `agents/salander.md` frontmatter and body**

```yaml
---
name: salander
description: Feature-level research. Takes the inquiry report, researches options for this specific feature, runs a deep brainstorm loop comparing pros/cons in depth to pick the best low-level design. Writes a human and an AI research report.
model: claude-sonnet-5
tools: Read, Write, Grep, Glob, WebSearch, WebFetch
---
```

Body must specify: deep brainstorm-to-decide-more-research loop with
explicit pros/cons comparison of options; goal is picking the best
low-level design for this one feature; writes both report files.

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/hermione.md && bash scripts/validate-agent-frontmatter.sh agents/salander.md`**

Expected: PASS for both.

- [ ] **Step 4: Commit**

```bash
git add agents/hermione.md agents/salander.md
git commit -m "feat: add Hermione (system) and Salander (feature) research agents"
```

---

### Task 7: Sherlock (brainstorm)

**Files:**
- Create: `agents/sherlock.md`

**Interfaces:**
- Consumes: request + inquiry report pair + research report pair.
- Produces: `<path>/brainstorm-report-human.md`, `<path>/brainstorm-report-ai.md`.

- [ ] **Step 1: Write `agents/sherlock.md` frontmatter**

```yaml
---
name: sherlock
description: Brainstorm phase, same agent for phase-road and workflow-road. Takes the request plus inquiry and research reports, produces ranked recommendations, can ask follow-up questions. Writes a human and an AI brainstorm report.
model: claude-opus-5
reasoning_effort: medium
tools: Read, Write, Grep, Glob
---
```

- [ ] **Step 2: Write Sherlock's body**

Must specify: produces ranked recommendations (not a single prescribed
answer); may ask the user follow-up questions when genuinely needed; plain
conversational tone per the spec's phases 1–4 note; writes both report
files.

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/sherlock.md`**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/sherlock.md
git commit -m "feat: add Sherlock brainstorm agent"
```

---

### Task 8: Askeladd (discussion)

**Files:**
- Create: `agents/askeladd.md`

**Interfaces:**
- Consumes: request + inquiry + research + brainstorm reports; on a workflow-road "discuss further" re-entry, also consumes the prior `discussion-report-ai.md`/`discussion-report-human.md` as comparison input.
- Produces: `<path>/discussion-report-human.md`, `<path>/discussion-report-ai.md` — overwritten in place on re-entry, no versioned filenames (design: Workflow-road vs phase-road).

- [ ] **Step 1: Write `agents/askeladd.md` frontmatter**

```yaml
---
name: askeladd
description: Discussion phase, same agent for phase-road and workflow-road. A sharp, ruthless-but-constructive debate partner, not a yes-man. On workflow-road re-entry after "let's discuss further", reads the previous discussion report as comparison input and overwrites it in place when done.
model: claude-opus-5
reasoning_effort: medium
tools: Read, Write, Grep, Glob
---
```

- [ ] **Step 2: Write Askeladd's body**

Must specify: debate-partner tone (pushes back, doesn't just agree); checks
whether `discussion-report-ai.md` already exists in the target path — if so
this is a re-entry, read it as comparison context for the new discussion
rather than starting blind; writes the new report pair over the old files
(no `-v2` suffixes); plain conversational tone per phases 1–4 note.

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/askeladd.md`**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/askeladd.md
git commit -m "feat: add Askeladd discussion agent"
```

---

### Task 9: Odin (system plans) and Odysseus (feature plans)

**Files:**
- Create: `agents/odin.md`
- Create: `agents/odysseus.md`

**Interfaces:**
- Consumes (both): user query + inquiry + research + brainstorm + discussion reports.
- Produces (both): `<path>/plans/plan-human.md`, `<path>/plans/plan-ai.md` (split into further modular docs under `plans/` if large).

- [ ] **Step 1: Write `agents/odin.md` frontmatter and body**

```yaml
---
name: odin
description: System-level plans. Takes query + inquiry/research/brainstorm/discussion reports, writes the phase breakdown plan for the whole system using ecc's planning-agent patterns. Produces plan-human.md and plan-ai.md under plans/, splitting into modular docs if large.
model: claude-sonnet-5
tools: Read, Write, Grep, Glob
---
```

Body must name the exact `ecc` agent/skill it defers to for planning
patterns (`ecc:planner` / `ecc:plan`, per the ecc agent roster) rather than
paraphrasing "use ecc's planner somehow".

- [ ] **Step 2: Write `agents/odysseus.md` frontmatter and body**

```yaml
---
name: odysseus
description: Feature-level plans. Takes query + inquiry/research/brainstorm/discussion reports, writes the implementation plan for one feature using ecc's planning-agent patterns. Produces plan-human.md and plan-ai.md under plans/, splitting into modular docs if large.
model: claude-sonnet-5
tools: Read, Write, Grep, Glob
---
```

Same `ecc` reference requirement as Odin, scoped to one feature's plan.

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/odin.md && bash scripts/validate-agent-frontmatter.sh agents/odysseus.md`**

Expected: PASS for both.

- [ ] **Step 4: Commit**

```bash
git add agents/odin.md agents/odysseus.md
git commit -m "feat: add Odin (system) and Odysseus (feature) planning agents"
```

---

### Task 10: L (test write + evaluate)

**Files:**
- Create: `agents/l.md`

**Interfaces:**
- Consumes: the plan pair from Odin/Odysseus (for writing tests); later, the actual implementation output from Gru (for evaluation).
- Produces: tests written against the plan's acceptance criteria (via `ecc`'s `tdd-workflow`); `<path>/test-report.md` with a pass/fail verdict once Gru's implementation exists.

- [ ] **Step 1: Write `agents/l.md` frontmatter**

```yaml
---
name: l
description: Writes tests first against the plan's acceptance criteria using ecc's tdd-workflow, then later evaluates Gru's implementation against those tests and writes test-report.md with a verdict.
model: claude-sonnet-5
tools: Read, Write, Edit, Bash, Grep, Glob
---
```

- [ ] **Step 2: Write L's body**

Must name `ecc:tdd-workflow` explicitly as the skill it invokes for the
write-tests-first step; must specify the two-pass nature of this agent
(first invoked to write tests before Gru runs, invoked again afterward to
evaluate and write `test-report.md`).

- [ ] **Step 3: Run `bash scripts/validate-agent-frontmatter.sh agents/l.md`**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/l.md
git commit -m "feat: add L test-writer/evaluator agent"
```

---

### Task 11: Gru (implement) and vendored `opencode-subagent` skill

**Files:**
- Create: `agents/gru.md`
- Create: `skills/opencode-subagent/` (vendored copy)

**Interfaces:**
- Consumes: the plan pair from Odin/Odysseus, L's written tests.
- Produces: `<path>/implementation-log.md`; dispatches minion workers via the vendored `opencode-subagent` skill (not plain `Agent` tool subagents).

- [ ] **Step 1: Locate the source `opencode-subagent` skill**

Run: `find ~/.claude -maxdepth 6 -type d -iname "opencode-subagent"`
Expected: one path under the existing skills install (plugin cache or
user skills dir).

- [ ] **Step 2: Vendor it into this plugin's repo**

```bash
cp -R <located-path>/. skills/opencode-subagent/
```

Copy every file verbatim (no renaming) so the skill works unmodified when
this plugin is installed standalone, with no external `opencode-subagent`
dependency (design: Constraints).

- [ ] **Step 3: Write `agents/gru.md` frontmatter**

```yaml
---
name: gru
description: Implement phase. Reads the plan and decides whether work parallelizes across minions or must go step-by-step, then dispatches minions via the bundled opencode-subagent skill. Writes implementation-log.md.
model: claude-sonnet-5
tools: Read, Write, Edit, Bash, Grep, Glob, Skill
---
```

- [ ] **Step 4: Write Gru's body**

Must specify: read the plan's task breakdown; judge parallelizable vs
sequential-only work (dependent interfaces between tasks force sequential);
dispatch each unit of work by invoking the `opencode-subagent` skill (not
the generic `Agent` tool) per that skill's documented invocation pattern;
log dispatch decisions and outcomes to `implementation-log.md`.

- [ ] **Step 5: Run `bash scripts/validate-agent-frontmatter.sh agents/gru.md`**

Expected: PASS.

- [ ] **Step 6: Run `test -f skills/opencode-subagent/SKILL.md`**

Expected: PASS (file exists, vendoring succeeded).

- [ ] **Step 7: Commit**

```bash
git add agents/gru.md skills/opencode-subagent
git commit -m "feat: add Gru implement agent and vendor opencode-subagent skill"
```

---

### Task 12: `/factory` guided-mode command

**Files:**
- Create: `commands/factory.md`

**Interfaces:**
- Consumes: the user's initial request.
- Produces: a sequential Hodor → (Ullr | Aragorn → Heimdal → Research → Sherlock → Askeladd → Odin/Odysseus → L → Gru → L) handoff, pausing for explicit user confirmation before each handoff, allowing a step to be skipped on confirmation.

- [ ] **Step 1: Write `commands/factory.md`**

Must specify the exact handoff order per the design's Decision layer and
Phases sections; after each agent finishes, the command must pause and ask
the user to confirm before invoking the next agent, and must allow the user
to say "skip this one" for any phase (design: Usage modes item 1). Must
branch correctly: trivial → Ullr only, non-trivial phase-road → phases 1–8
once, non-trivial workflow-road → phases 1–5 at system level then phase-road
per identified feature, sequentially, then the system-complete confirmation
with its two branches (full reset vs carry-forward discussion) exactly as
specified in Workflow-road vs phase-road.

- [ ] **Step 2: Run `test -s commands/factory.md`**

Expected: PASS (file non-empty; this plugin's command format has no
required frontmatter schema, unlike agents).

- [ ] **Step 3: Commit**

```bash
git add commands/factory.md
git commit -m "feat: add /factory guided-mode command"
```

---

### Task 13: `/factory-<phase>` direct single-phase commands

**Files:**
- Create: `commands/factory-inquiry.md`
- Create: `commands/factory-research.md`
- Create: `commands/factory-brainstorm.md`
- Create: `commands/factory-discussion.md`
- Create: `commands/factory-plans.md`
- Create: `commands/factory-test.md`
- Create: `commands/factory-implement.md`

**Interfaces:**
- Consumes: a target folder path (resolved the same way Aragorn resolves one) and the invoked phase's upstream artifact requirements (e.g. `/factory-discussion` requires inquiry+research+brainstorm reports to exist).
- Produces: before invoking the named agent, checks each required upstream artifact's existence (file-existence check only, per v1 scope) in the target folder; for each missing artifact, invokes that specific upstream agent first; for each present artifact, uses it as-is. Never re-triggers an upstream agent whose artifact already exists.

- [ ] **Step 1: Write the shared existence-check instructions once, then one command file per phase**

Each `commands/factory-<phase>.md` names its own required upstream artifact
set explicitly (e.g. `factory-discussion.md` requires
`inquiry-report-ai.md`, `research-report-ai.md`, `brainstorm-report-ai.md`
to exist in the resolved path) and instructs: check each with a file-
existence test, invoke the owning upstream agent only for the missing ones,
then invoke the named phase's own agent.

- [ ] **Step 2: Run `for f in commands/factory-inquiry.md commands/factory-research.md commands/factory-brainstorm.md commands/factory-discussion.md commands/factory-plans.md commands/factory-test.md commands/factory-implement.md; do test -s "$f" || echo "EMPTY: $f"; done`**

Expected: no output (every file is non-empty).

- [ ] **Step 3: Commit**

```bash
git add commands/factory-inquiry.md commands/factory-research.md commands/factory-brainstorm.md commands/factory-discussion.md commands/factory-plans.md commands/factory-test.md commands/factory-implement.md
git commit -m "feat: add /factory-<phase> direct single-phase commands with artifact-existence checks"
```

---

### Task 14: `/factory-auto` fully autonomous command

**Files:**
- Create: `commands/factory-auto.md`

**Interfaces:**
- Consumes: the user's initial request.
- Produces: the same agent-to-agent handoff sequence as `/factory`, but with zero confirmation pauses (design: Usage modes item 3).

- [ ] **Step 1: Write `commands/factory-auto.md`**

Same branching logic as Task 12's `/factory` (trivial/phase-road/
workflow-road, sequential nested features, system-complete confirmation
loop), but every agent-to-agent handoff proceeds immediately with no pause
for user confirmation and no per-phase skip option — autonomy, not
guidance.

- [ ] **Step 2: Run `test -s commands/factory-auto.md`**

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add commands/factory-auto.md
git commit -m "feat: add /factory-auto fully autonomous command"
```

---

### Task 15: Final plugin-wide validation

**Files:**
- Modify: none (validation only)

**Interfaces:**
- Consumes: every file created in Tasks 1–14 plus `.claude-plugin/plugin.json`.
- Produces: a pass/fail confirmation that the manifest and the filesystem agree.

- [ ] **Step 1: Run `bash scripts/validate-plugin.sh`**

Expected: PASS (every agent, command, and skill path in `plugin.json`
exists on disk — this is the same script that was expected to FAIL in
Task 1 Step 4, now passing because all referenced files exist).

- [ ] **Step 2: Run frontmatter validation across every agent in one pass**

```bash
for f in agents/*.md; do bash scripts/validate-agent-frontmatter.sh "$f" || echo "FAILED: $f"; done
```

Expected: no "FAILED" lines.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final fellowship plugin validation pass"
```

(Only if Steps 1–2 produced follow-up fixes to commit; if nothing changed, this step is skipped.)
