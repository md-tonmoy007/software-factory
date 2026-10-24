---
name: opencode-subagent
description: Delegate coding, review, research, or file-editing work to a headless non-interactive opencode subagent with `opencode run` (or the CLI-compatible `kilo run`). Use when asked to use opencode as a subagent, run opencode headless, spawn an opencode worker, delegate a task to a separate agent context, run parallel coding workers, or drive opencode from Claude Code, Codex, OpenClaw, Hermes, Kilo, or another agent harness. Covers model selection, reasoning effort/variants, agent selection, sessions, permissions, timeouts, structured results, and parallel workers.
---

# OpenCode headless subagent

Use this skill when work should happen in a **separate opencode context**: to save the parent agent's context, run tasks in parallel, use a different model or reasoning effort, or hand a self-contained job to a coding worker.

opencode `run` is the non-interactive entry point. It is a full agent, not a shell command: it can read files, edit files, run tools, and keep a session. The parent agent must give it enough context to work without the parent's conversation.

## Resolve the skill directory

`<skill-dir>` below means the absolute directory containing this `SKILL.md`, as reported by your harness. In Claude Code use `${CLAUDE_SKILL_DIR}`. If the harness does not expose it, locate it once:

```bash
SKILL_DIR=$(dirname "$(find "$HOME/.config/opencode" "$HOME/.claude" "$HOME/.codex" "$HOME/.agents" "$HOME/.openclaw" "$HOME/.hermes" "$HOME/.config/kilo" -path '*/opencode-subagent/SKILL.md' 2>/dev/null | head -n 1)")
```

## Rule 0: prefer the wrapper

The wrapper gives you model/effort aliases, a timeout, clean final text, JSON metadata, and reliable failure detection. Use it unless it is unavailable.

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --dir "$PWD" \
  --agent build \
  --timeout 900 \
  --json \
  "Implement the task described below.

Working directory: $PWD
Goal: ...
Constraints: ...
Deliverables: ...
Verification: run ...
Report: files changed, commands run, test results, blockers. End with STATUS: done|blocked|failed."
```

If Node is unavailable, call `opencode run` directly and follow the direct-CLI guidance in `references/cli.md`. The wrapper is the safer path because raw `opencode run` can exit `0` even when a tool call was rejected.

## Mental model

- The subagent **does not see the parent conversation**. Repeat the goal, paths, constraints, and acceptance criteria.
- The subagent works in a real directory and can modify files. Treat it as a coworker, not a text generator.
- Each invocation without `--continue` or `--session` creates a fresh session. Capture the returned `sessionID` for follow-ups.
- The subagent loads its own project config, `AGENTS.md`, skills, MCP servers, and permissions. It is not a sandbox unless you make it one.

## Workflow

### 1. Write a self-contained brief

Before launching, decide:

- **Goal** — one concrete outcome.
- **Workspace** — the absolute directory it may edit (`--dir`).
- **Scope** — files or areas to touch, and areas to leave alone.
- **Acceptance criteria** — tests to run, lint/typecheck commands, expected behavior.
- **Deliverable** — code, review notes, a report file, or a patch.
- **Reporting contract** — ask for files changed, commands run, test results, and `STATUS: done|blocked|failed`.

Point to files instead of pasting them when the subagent can read the repo. Attach non-repo inputs with `--file path` (repeatable).

### 2. Choose the agent

Use the narrowest agent that can do the job:

| Agent | Use for |
| --- | --- |
| `plan` | Read-only investigation, architecture review, planning, code reading. It cannot edit. |
| `build` | Normal implementation, file edits, running tests. |
| `general` | Multi-step research/implementation when the default build agent is too specialized. |
| `explore` | Fast codebase exploration and locating files or patterns. |
| custom | A project agent with its own prompt, model, permissions, or tool policy. |

List available agents with `opencode agent list`. Use `--agent <name>`.

### 3. Choose the model

Do not invent model IDs. Discover them:

```bash
opencode models
opencode models --verbose   # includes cost, context limit, and variants
```

Use the exact `provider/model` string:

```bash
--model "opencode/deepseek-v4.1-flash-free"
```

If the user names a model, use that — pass `--model` and the wrapper runs only that model (no substitution).

**If the user does not name a model**, omit `--model`. The wrapper (`scripts/opencode-subagent.mjs`) then no longer defers to opencode's bare default — it tries its own ranked list of free `opencode/*-free` models in order, falling through to the next one on `quota_exceeded`, `timeout`, or any other failure, and stopping at the first one that completes:

1. `opencode/glm-5.3-flash-free` — highest independently-verified SWE-bench Verified score (92%, Vals AI) among the free set
2. `opencode/deepseek-v4.1-flash-free` — consistently top-tier LiveBench coding (90–96) and SWE-bench (~81–89%)
3. `opencode/beam-free` — Reflection AI, purpose-built for agentic coding (80.9% SWE-bench Verified, vendor-reported)
4. `opencode/nemotron-3.5-super-vl-free` — solid mid-tier coding, good multimodal fallback
5. `opencode/big-pickle` — unlabeled stealth model; potentially capable but unverifiable, and its free-period usage may train the vendor's model
6. `opencode/mimo-v2.6-flash-free` — plausible coding ability but public allegations of inflated self-reported benchmarks
7. `opencode/nemotron-3-ultra-free` — weak coding-specific score; superseded by the 3.5 Nemotron variants
8. `opencode/flint-40b-free` — no independently-verified benchmark found; small/new lab
9. `opencode/nemotron-3.5-lightning-free` — lowest measured coding score of the set; fast but not capable enough for general coding work

This ranking and its sourcing live in `docs/opencode-free-models-coding-report.md` at the repo root — re-read that file (not this list) if the ranking needs to change, since the list here is a copy for quick reference.

The JSON result's `attempts` array records every model tried and its outcome (e.g. `glm-5.3-flash-free (quota_exceeded) -> deepseek-v4.1-flash-free (completed)`), and `result.model` names whichever one actually produced the final output — report that to the user, don't assume it was the first one.

This fallback is specifically for *free* models used as plan-following workers; it does not apply to `--bin kilo` or custom/paid models. The model must exist in the same provider namespace used by `--bin` (opencode vs kilo) — the default list above assumes `--bin opencode` (the default).

### 4. Choose reasoning effort

opencode exposes provider-specific reasoning effort as a **model variant**. The wrapper calls it `--effort` (native flag: `--variant`). Common values are `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`, but the exact set depends on the model.

Check the model's `variants` in `opencode models --verbose`, then:

```bash
--model "provider/model" --effort high
```

Omit `--effort` to use the model's default. Raising effort costs more tokens and latency; use it for hard debugging, architecture, or review, not routine edits. If the model has no variants, opencode will reject the flag.

### 5. Handle permissions deliberately

Non-interactive runs cannot answer a permission prompt. When a tool needs approval, opencode's default behavior in `run` is to **auto-reject** the call. A rejection does not change the process exit code, which is why the wrapper checks the event stream.

- Working inside `--dir` with the `build` agent is normally allowed by default.
- Paths outside `--dir`, sensitive commands, or restrictive project permissions may be rejected.
- `--auto` auto-approves permissions that are **not explicitly denied**. It is powerful and dangerous: only use it when the user asked for autonomous work and the workspace is trusted.
- Safer alternative: configure an agent with the exact permission rules you need, then select it with `--agent`.

If a run fails with `permission requested ... auto-rejecting`, either run inside the intended workspace, adjust the agent/permission config, or re-run with `--auto` after confirming with the user.

### 6. Execute and inspect the result

Default invocation (clean text result):

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --dir "$PWD" --agent build --timeout 900 \
  "Add a unit test for parse_config in tests/test_config.py. Run pytest tests/test_config.py. Report results."
```

Machine-readable invocation:

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --dir "$PWD" --agent build --timeout 900 --json \
  "..." > /tmp/opencode-result.json
```

The JSON result contains:

```json
{
  "ok": true,
  "status": "completed",
  "sessionID": "ses_...",
  "text": "final assistant message",
  "usage": { "input": 0, "output": 0, "reasoning": 0, "cost": 0 },
  "toolErrors": [],
  "errors": [],
  "durationMs": 0
}
```

Use `--raw` to stream opencode's raw JSON events instead, and `--log path` to save them. The wrapper returns non-zero on a failed process, a fatal event, a timeout, missing final text, or a **permission failure**. Other tool errors are reported in `toolErrors` but do not fail a run that produced final text. Use `--strict-tool-errors` to fail on any tool error, or `--allow-tool-errors` to ignore even permission failures when the worker recovered.

### 7. Continue or repair with a session

If the result is incomplete or a verification fails, continue the same session instead of starting over:

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --dir "$PWD" --agent build --timeout 900 --json \
  --session "ses_abc123" \
  "The test still fails with this output: ... Fix it and rerun the test."
```

Use `--fork` with `--session` to branch without mutating the original session. Use `--continue` only for the last session in the same directory, and never in parallel workers because they can collide.

### 8. Report back to the user

Report what the subagent actually did, not the raw event stream:

- outcome and files changed
- verification commands and their results
- blockers or permission failures
- session ID if follow-up is likely
- model/effort used if relevant

## Parallel workers

Run independent tasks concurrently, but keep control of scope:

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" --dir "$PWD" --agent plan --timeout 600 --json \
  "Review src/auth for security issues. Do not edit files." > /tmp/auth-review.json &

node "<skill-dir>/scripts/opencode-subagent.mjs" --dir "$PWD" --agent plan --timeout 600 --json \
  "Map the test suite and identify missing coverage in src/payments. Do not edit files." > /tmp/payments-review.json &

wait
```

Guidelines:

- Cap concurrency at 2–4; more workers usually cost more than they save.
- Give parallel workers **disjoint files** or make them read-only. Two build agents editing the same file will conflict.
- Do not use `--continue` in parallel. Let each create its own session, or pass explicit session IDs.
- For risky parallel edits, use separate git worktrees and point `--dir` at each one.
- Set `--timeout` on every unattended worker; a hung worker otherwise blocks the parent.

## Direct CLI fallback

If the wrapper cannot run, use the native command:

```bash
opencode run \
  --dir "$PWD" \
  --agent build \
  --model "provider/model" \
  --variant high \
  --format json \
  --auto \
  "your self-contained task"
```

Key native flags:

- `--dir` — workspace
- `--agent` — agent name
- `--model provider/model` — model
- `--variant` — reasoning effort
- `--format json` — one JSON event per line (recommended for parsing)
- `--session <id>` / `--continue` / `--fork` — session control
- `--file` — attach file(s)
- `--auto` — auto-approve non-denied permissions
- `--title` — session title
- `--thinking` — show thinking blocks

Read `references/cli.md` for wrapper options, event shapes, and failure handling. Read `references/harness-install.md` for install paths in opencode, Claude Code, Codex, OpenClaw, Hermes, and Kilo.

## Usage limits

opencode's own CLI does not fail cleanly when a provider's free quota or rate
limit is exhausted: the error is only ever written to opencode's internal log
stream, never to a JSON event or the process exit code, and the process then
**hangs indefinitely** instead of exiting. The wrapper watches for this
pattern (`usage limit reached`, `quota exceeded`, `rate limit exceeded`, `429`)
in that log stream, kills the hung worker immediately instead of waiting out
`--timeout`, and reports:

```json
{ "ok": false, "status": "quota_exceeded", "exitCode": 75, "sessionID": "ses_...", "quotaExceeded": true, "quotaMessage": "..." }
```

**This is a quota condition, not a bug in the task or the subagent's work.**
When you (the calling/main agent) see `status: "quota_exceeded"`:

- Do not treat it the same as `"failed"` or retry blindly with the same model.
- Before doing anything else, **check what the subagent already did** up to
  the point the limit hit: run `git status` / `git diff` in the workspace,
  and look at any partial text the worker produced (`text`/`allText` in the
  JSON result, even if empty). A limit can be hit mid-edit, after useful
  file changes were already made.
- If a `sessionID` was captured, you can resume that exact session (see
  "Continue or repair with a session") once a working model/provider is
  available — do not discard the session and start over by default.
- Switch to a different model/provider, wait for the quota to reset, or tell
  the user authentication/a paid tier is needed, rather than reporting the
  overall task as failed.
- If calling `opencode run` directly instead of the wrapper, pass
  `--print-logs` yourself (the wrapper always adds it) or you will see no
  output at all and the process will hang with no diagnostic.

## Failure playbook

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `ok: false`, tool error says permission auto-rejected | Non-interactive approval needed | Work inside `--dir`, fix permissions, or use `--auto` if authorized |
| `ok: true` but `toolErrors` is non-empty | A non-permission tool failed and the worker recovered | Review the errors; add `--strict-tool-errors` if the task must be failure-free |
| Exit code `0` but no useful text | Agent blocked or stopped early | Inspect `toolErrors`/`errors`, retry with a tighter brief or continue session |
| `status: "timeout"` | Task too large or hung | Raise `--timeout`, narrow scope, or inspect the log and continue |
| `status: "quota_exceeded"` | Provider/model usage limit or rate limit hit | Not a task failure — see "Usage limits" below |
| Model/variant rejected | Wrong model ID or unsupported effort | Re-check `opencode models --verbose`; omit `--effort` |
| Session not found | Wrong workspace or stale ID | Start a fresh session; `--continue` only works in the same directory |
| Parallel workers clobber each other | Shared files | Use disjoint scopes, read-only agents, or separate worktrees |
| Wrapper says Node missing | Node not installed | Use the direct CLI fallback; the skill still works |

## Do not

- Do not launch the opencode TUI (`opencode` with no subcommand) from an agent. It is interactive and will hang.
- Do not assume raw `opencode run` failed just because the exit code is non-zero, or succeeded just because it is zero. Inspect JSON.
- Do not use `--auto` on an untrusted directory or for destructive operations without explicit user approval.
- Do not delegate secrets, API keys, or private credentials in the prompt. Pass them via environment or a file the subagent can read.
- Do not start a new session for a small correction to a failed run; continue the existing session.
