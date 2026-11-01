---
name: memory
description: Single source of truth for the Fellowship plugin's target-project memory layout, wiki entry schema, two-stage write gate, secrets-scrubbing procedure, and the deferred graphify extension point. Invoked as fellowship:memory by agents/mimir.md (the sole writer) and read-side by Hermione, Salander, Gru, L, and Ullr.
---

# fellowship:memory

This skill is the single source of truth for how the Fellowship plugin
remembers things about the **target project** it works on (never about
this plugin repo itself). It is invoked by name as `fellowship:memory`
(namespaced, because a bare `memory` can collide with an unrelated
same-named user-level skill — same hazard `agents/gru.md` already
documents for `opencode-subagent`).

This is the "wiki" layer only: an append-only record of debug/patch
episodes — what went wrong, how it was actually solved. It is deliberately
**not**:
- a code-structure graph (that's `graphify`, a separate, already-installed
  tool — see "v1.1 extension point: graphify" below; not invoked in v1),
- a second source of task state (that's `implementation-log.md`, owned by
  Gru, tightened separately — this skill never writes task state),
- a vector/embedding store, a hosted database, a cross-user store, or a
  background watcher process. None of those exist in v1.

## Who reads, who writes

- **Mimir** (`agents/mimir.md`) is the sole writer. It runs terminally:
  after Ullr on the trivial path, and after L Pass 2 / Gru on the small and
  feature lanes, and only when the main session's cheap screen finds a Stage 1
  signal (see `commands/factory.md`). It never runs mid-pipeline.
- **Hermione, Salander, Gru, L, Ullr** are the only readers in v1 (self-service: each
  decides for itself, at its own point of need, whether to consult the
  wiki — there is no upfront digest and no centrally-injected recall).
  Five other agents (`heimdal, askeladd, odin, odysseus,
  code-explorer`) are deferred readers — not wired to this skill
  in v1, widen later if useful.
- **Hodor** scaffolds the directory and the gitignore exemption at
  target-project setup time (see `agents/hodor.md`) but performs zero
  memory reads itself — that's a setup action, not a reader capability.

## Directory layout

Inside the **target project** (never this plugin repo):

```
<target>/.fellowship/memory/
  wiki/
    index.md
    events/
      <YYYY-MM-DD>-<slug>.md
```

`<target>/.fellowship/memory/` is the one subtree inside `.fellowship/`
that is **exempted from `.gitignore`** — it travels with, and is committed
to, the target project's own git history, even though the rest of
`.fellowship/` (run folders, `config.json`) stays gitignored. Hodor keeps
this exemption in place on every run (`agents/hodor.md`), using `.fellowship/*`
plus `!.fellowship/memory/`, because git can't re-include anything under a
directory that is itself ignored.

Do not confuse this with `graphify`'s own `--wiki` generator output
(`<target>/graphify-out/wiki/`) — that is a regenerated, structural
code-overview wiki from an unrelated tool, naming collision only,
not invoked in v1.

## Wiki entry frontmatter schema

One file per episode, at `wiki/events/<YYYY-MM-DD>-<slug>.md`:

```yaml
---
id: <YYYY-MM-DD>-<slug>
date: <YYYY-MM-DD>
origin: <trivial | full-pipeline>
run_path: <the <folder-name>/<phase-name>/ this episode came from>
symptom: <what was observed going wrong>
initial_hypothesis: <what was first suspected>
root_cause: <what was actually wrong>
resolution: <what fixed it>
files_touched: [<path>, ...]
verification: <command/check run + result>
commit: <commit hash or "uncommitted">
tags: [<short>, <tags>]
entry_reason: <REQUIRED — which write-gate clause fired, see below>
see_also: [<id>, ...]        # optional
superseded_by: <id>          # optional
---

<body: free-text narrative of the episode, "describe don't paste" per
the secrets rule below>
```

`entry_reason` is **required on every entry, no exceptions**. It is what
makes the write-gate's judgement auditable after the fact — a reviewer (or
the ADR-6 ~10-run review) can check *why* Mimir thought this entry earned
its place, not just that it exists.

## `index.md`: append/idempotent-insert only

`index.md` is a flat list of one line per entry (id, date, one-line
symptom, tags). It is **never regenerated wholesale** — every write is
either an append of a new line or an idempotent insert-if-not-present
check (so a re-run of the same episode doesn't duplicate its own index
line). Treat a full rewrite of this file as a bug, always.

Readers find entries via `Grep`/`Glob` over `index.md` and `events/*.md`
— no embeddings, no vector store, no index beyond this flat file, in v1.

## Two-stage write gate

Mimir runs this gate every time it's dispatched, before writing anything. The
main session applies Stage 1 first as a cheap screen, so it only dispatches
Mimir when a signal exists. Mimir still re-checks it, since it's cheap and the
source files are authoritative.

**Stage 1 — mechanical candidate screen.** An episode is a *candidate*
(proceed to Stage 2) if any of these hold, read straight from
`implementation-log.md`, `test-report.md`, or Ullr's report fields:
- `failed_approaches` is non-empty for any task,
- a test failed and later passed within the same run,
- a report names a root cause distinct from the originally reported
  symptom,
- `status: blocked` or `status: failed` appears anywhere in the log.

If none hold, stop here — no entry, report "no entry — reason: no
candidate signal in this run's logs" and stop. Do not proceed to Stage 2.

**Stage 2 — judgement checklist (candidates only).** Write an entry iff
at least one of these is true for the candidate, and record which one in
`entry_reason`:
- a hypothesis was explicitly held and then disproved,
- the root cause lived in a different file/component than the symptom,
- the fix required understanding a non-obvious interaction between parts,
- an environment/tooling trap cost real time to work through,
- a test revealed a hidden coupling not visible from the plan alone.

**Explicit do-not-write list** (write nothing, even if Stage 1 flagged a
candidate):
- feature work that went as planned (no real dead end, just normal build
  steps logged as "in-progress" → "done"),
- formatting, renames, dependency bumps, doc-only edits,
- a failure whose cause was stated verbatim in the error message (nothing
  was actually discovered),
- workflow-road runs — no implementation occurred, so there is no episode
  to harvest (see `commands/factory.md`'s "Memory available" section).

**Mandatory reporting either way.** Mimir's closing report always states
one of:
- `"entry written at <path>, reason: <entry_reason>"`, or
- `"no entry — reason: <why>"`.

Never a silent skip. This per-run report is the ADR-6 review's dataset —
the thing that answers, after ~10 real runs, whether this gate is
calibrated right. Do not treat §"conformance checks" acceptance criteria
as a hard release gate; they're checked for behavior correctness, the
value question is answered later from this report history.

**Duplication check.** Before writing, `Grep` `events/*.md` frontmatter
(`tags`, `symptom`) for a near-match to the current candidate. On a
near-match, still append the new entry (never suppress solely because
something similar exists — R1, non-negotiable) but populate `see_also`
with the matched id(s).

## Secrets-scrubbing procedure

This procedure exists because a wiki entry can plausibly end up quoting
a real secret from a log or error message, and the "memory must never
break a run" invariant (R5) means the fix for that can't be an unbounded
retry loop.

1. **Authoring rule.** Mimir describes problems in prose, cites
   `path:line` references, and paraphrases — it never pastes raw code
   blocks, `.env` file contents, or CI secret-context output verbatim
   into a draft entry.
2. **Mechanical gate.** Write the draft to a scratch/run-local path first
   — **this path must itself be git-ignored**, never the real
   `wiki/events/` location yet. Run a deterministic regex scan over the
   draft for: AWS-style access keys, `gh[pousr]_`/`sk-` token prefixes,
   PEM private-key headers, `(key|secret|token|passwd|password)\s*[:=]`,
   database connection-string URIs with embedded credentials,
   `Authorization:\s*(Bearer|Basic)`, and bare high-entropy base64/hex
   strings 32+ characters long.
3. **On a hit:** exactly **one** redaction pass, replacing each hit with
   `<redacted:<kind>>`, then exactly **one** re-scan.
   - If the re-scan is clean, move the draft to the real `wiki/events/`
     location and write it.
   - If the re-scan **still** hits: **discard the entry entirely — write
     nothing** — and report the suppression and its cause plainly in
     Mimir's closing report. Do not loop, do not escalate, do not block
     the run. This is a hard stop at one retry, by design — it is the
     fix for an earlier version of this procedure that had no bound.
4. **Attestation.** Mimir's closing report includes one line stating the
   scan ran and its outcome (clean / redacted-then-clean / discarded) —
   this is a run-report line, not a frontmatter field (a frontmatter
   field would rot as the entry ages and the scan's own rules evolve).

## v1.1 extension point: graphify (not built in v1)

`graphify` (`~/.claude/skills/graphify/SKILL.md`, wrapping the `graphifyy`
Python package) is a real, already-installed, AST-based code-knowledge-
graph tool: persistent `graph.json`, zero-LLM-cost `--update` incremental
re-extraction, `--watch`, a post-commit git hook, an MCP query server, and
its own unrelated `--wiki` generator (see the naming-collision note
above). It is the deferred code-derived memory layer (ADR-3): deferred,
not rejected, because code-derived knowledge is cheap to regenerate later
via `--update`, whereas wiki episodes lost today are lost permanently —
the asymmetry favors spending v1's budget on the wiki layer.

When v1.1 picks this up, the design already agreed (but not built) is:
- **E1 — single source of truth.** All graphify CLI detail lives in this
  skill file (or its `references/` split, if this file grows past the
  split threshold below) — never restated inline in any agent file. This
  is the same ADR-1 discipline this skill already upholds for the wiki.
- **E4 — on-demand probe, never cached.** Any future graphify-consuming
  agent checks `command -v graphify` at the point of need, every time —
  never assumes presence from a prior run, never caches the probe result.
- **A three-state degradation ladder:** graphify present and graph fresh
  → use it; graphify present but graph stale → run `--update` first, then
  use it; graphify absent → fall back to `Grep`/`Glob`/`code-explorer`,
  exactly as agents do today, and say so rather than failing.

**Nothing above is built or invoked in v1.** No agent in this plugin
calls any `graphify` command, no `graph/` subdirectory exists, no probe
is wired in. This section exists so v1.1 doesn't have to re-derive the
design, not to partially implement it now.

## If this file grows past ~300 lines

Split into `references/entry-schema.md`, `references/secrets-scrubbing.md`,
`references/write-gate.md`, keeping this file itself as a short index that
points into them. Not done preemptively — only if content genuinely
outgrows a single file at a future edit.

## What this skill does not do

- It does not write or read `implementation-log.md` — that's Gru's file,
  tightened separately (see `agents/gru.md`).
- It does not implement, probe, or reference any graphify command in v1.
- It does not run on workflow-road (system-level) passes — no
  implementation occurred, so there is nothing to harvest; see
  `commands/factory.md`'s "Memory available" section for how that's
  handled at the dispatch-decision level.
- It never makes a run fail. Every failure mode here (scan hit twice,
  directory missing, anything else) ends in "log and continue," never a
  blocked pipeline.
