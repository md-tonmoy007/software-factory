# Headless opencode CLI reference

Everything in this file is about the **non-interactive** path: `opencode run`.
Never use the bare `opencode` TUI command from an agent; it blocks on user input.

## Contents

1. [Wrapper reference](#wrapper-reference)
2. [Native `opencode run` flags](#native-opencode-run-flags)
3. [Models and reasoning effort](#models-and-reasoning-effort)
4. [Agents](#agents)
5. [Sessions](#sessions)
6. [Permissions and non-interactive safety](#permissions-and-non-interactive-safety)
7. [JSON event stream](#json-event-stream)
8. [Exit codes and failure detection](#exit-codes-and-failure-detection)
9. [Parallel workers](#parallel-workers)
10. [Remote server mode](#remote-server-mode)
11. [Kilo and other CLI-compatible forks](#kilo-and-other-cli-compatible-forks)
12. [Troubleshooting](#troubleshooting)

## Wrapper reference

The wrapper is `scripts/opencode-subagent.mjs` (Node 18+). It invokes
`opencode run --format json`, parses the events, and prints clean output.

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" [options] [--] "prompt"
```

### Input and workspace

| Option | Meaning |
| --- | --- |
| `--dir <path>` / `--cwd <path>` | Workspace passed to opencode. The wrapper also starts the child there. |
| `-f, --file <path>` | Attach a file. Repeatable. Relative paths resolve from the parent's cwd. |
| `--stdin` | Read the prompt from stdin. |
| `--` | End option parsing; the rest is the prompt. |

### Model, effort, and agent

| Option | Meaning |
| --- | --- |
| `-m, --model <provider/model>` | Select the model. Use an exact ID from `opencode models`. |
| `--effort <value>` | Alias for opencode's `--variant`. Provider-specific reasoning effort. |
| `--variant <value>` | Native opencode spelling; same behavior as `--effort`. |
| `--agent <name>` | `plan`, `build`, `general`, `explore`, or a custom agent. |
| `--bin <name-or-path>` | `opencode` (default), `kilo`, or an explicit binary. |

### Sessions

| Option | Meaning |
| --- | --- |
| `-s, --session <id>` | Continue a specific session. |
| `-c, --continue` | Continue the last session in the workspace. |
| `--fork` | Fork before continuing. Requires `--session` or `--continue`. |
| `--title <text>` | Give the new session a title. |

### Execution

| Option | Meaning |
| --- | --- |
| `--timeout <dur>` | Kill the worker after `30`, `90s`, `10m`, or `1h`. Default off. |
| `--auto` | Auto-approve permissions that are not explicitly denied. Dangerous. |
| `--thinking` | Show thinking blocks. |
| `--pure` | Skip external plugins. |
| `--attach <url>` | Attach to a running opencode server. |
| `--port <n>` | Use a specific local server port. |
| `--command <name>` | Run an opencode command template. |
| `--log-level <level>` | `DEBUG`, `INFO`, `WARN`, or `ERROR`. |
| `--print-logs` | Print opencode logs to stderr. |

### Output

| Option | Meaning |
| --- | --- |
| `--json` | Print the aggregated result as JSON. |
| `--raw` | Print raw opencode JSONL events as they arrive. |
| `--format text\|json\|raw` | Explicit output mode. Default `text`. |
| `--log <path>` | Save raw JSONL events to a file. |
| `--allow-tool-errors` | Ignore all tool errors, including permission failures. |
| `--strict-tool-errors` | Fail when any tool call errors, not just permission failures. |
| `--verbose` | Print metadata, notices, and captured stderr to stderr. |
| `--dry-run` | Print the command without running it. |

### Output modes

`text` (default) prints only the worker's final assistant message to stdout.
Diagnostics and errors go to stderr. This is the best mode for a parent agent
that just needs the result.

`json` prints one object:

```json
{
  "ok": true,
  "status": "completed",
  "exitCode": 0,
  "signal": null,
  "sessionID": "ses_...",
  "agent": "build",
  "model": "provider/model",
  "effort": "high",
  "text": "final assistant message",
  "allText": "all assistant text, joined",
  "usage": {
    "input": 0,
    "output": 0,
    "reasoning": 0,
    "cacheRead": 0,
    "cacheWrite": 0,
    "total": 0,
    "cost": 0
  },
  "toolErrors": [],
  "errors": [],
  "notices": [],
  "quotaExceeded": false,
  "quotaMessage": null,
  "stderr": "",
  "durationMs": 12345,
  "log": "/path/to/log.jsonl"
}
```

`usage` is the sum of the `step_finish` events in this invocation. A continued
session does not include usage from earlier invocations.

`quotaExceeded`/`quotaMessage` are set when the wrapper detects a provider
usage-limit or rate-limit error in opencode's log stream (always captured via
an internal `--print-logs`). opencode's own CLI hangs indefinitely after this
error instead of exiting, so the wrapper kills the worker as soon as it sees
the message rather than waiting for `--timeout`. Treat `status:
"quota_exceeded"` as a transient, retry-later condition, not a task failure —
see the SKILL.md "Usage limits" section for what to do with any `sessionID`
and partial progress before retrying.

`raw` streams the untouched JSONL lines (plus occasional non-JSON permission
notices) to stdout. Use it when another program needs the events in real time.

### Status values

| `status` | Meaning |
| --- | --- |
| `completed` | Process finished, final text exists, no fatal errors. |
| `failed` | Process error, permission failure, fatal event, or no final text. |
| `timeout` | Wrapper killed the worker after `--timeout`. |
| `quota_exceeded` | Provider usage/rate limit hit; wrapper killed the hung worker as soon as it detected the log message. Not a task failure — see "Usage limits" in SKILL.md. |

`ok` is `true` only for `completed`. A failed run can still contain partial
`text` and a `sessionID`; use the session to continue.

## Native `opencode run` flags

From `opencode run --help` (1.19.x):

```text
opencode run [message..]

  -h, --help            show help
  -v, --version         show version number
      --print-logs      print logs to stderr
      --log-level       DEBUG | INFO | WARN | ERROR
      --pure            run without external plugins
      --command         the command to run, use message for args
  -c, --continue        continue the last session
  -s, --session         session id to continue
      --fork            fork before continuing (requires -c or -s)
  -m, --model           model as provider/model
      --agent           agent to use
      --format          default | json
  -f, --file            file(s) to attach (repeatable)
      --title           session title (optional value)
      --attach          attach to a running server, e.g. http://localhost:4096
  -p, --password        server password (defaults to OPENCODE_SERVER_PASSWORD)
  -u, --username        server username (default: opencode)
      --dir             directory to run in
      --port            local server port
      --variant         provider-specific reasoning effort
      --thinking        show thinking blocks
  -i, --interactive     direct interactive split-footer mode (do not use)
      --auto            auto-approve non-denied permissions
```

The wrapper does not expose `-i` because a headless parent must never enable
the interactive footer. It also does not pass server passwords on the command
line; use `OPENCODE_SERVER_PASSWORD` with `--attach` when needed.

## Models and reasoning effort

List models:

```bash
opencode models
opencode models anthropic
opencode models --verbose
```

The verbose output is a concatenated catalog, not one JSON document. For each
model it shows metadata including `variants`:

```json
{
  "id": "beam-free",
  "providerID": "opencode",
  "capabilities": { "reasoning": true },
  "variants": {
    "low": { "reasoningEffort": "low" },
    "medium": { "reasoningEffort": "medium" },
    "high": { "reasoningEffort": "high" },
    "max": { "reasoningEffort": "max" }
  }
}
```

Use the full `provider/id` string with `--model`, and one of that model's
variant keys with `--effort`:

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --dir "$PWD" --agent build \
  --model "opencode/beam-free" --effort high \
  "Refactor the parser and run the tests."
```

If a model does not list `variants`, omit `--effort`; opencode rejects
unsupported variants. If the user asks for "max thinking" or "high effort",
map that to a variant supported by the selected model rather than guessing.

### Model selection strategy

- **Exploration / mapping** — a fast, cheap model. Read-only `plan` agent.
- **Implementation** — a model strong at tool calls and code edits.
- **Review / hard debugging** — a stronger model with `high` or `max` effort.
- **Cost control** — avoid re-running the same task with a larger model; use a
  session continuation with a narrower repair prompt first.

The model namespace must match the binary. `opencode` uses its own catalog;
`kilo` lists `kilo/...` models. Use `--bin kilo` only when its catalog is
configured and authenticated.

## Agents

List agents:

```bash
opencode agent list
opencode debug agent build
```

Default `build` can edit and run tools. `plan` is read-only. Use `plan` for
reviews and investigation so a stray tool call cannot modify the workspace.
Custom agents can pin a model, variant, prompt, and permission set; selecting
one with `--agent` is often better than passing many flags.

## Sessions

- Every `run` without `--continue` / `--session` creates a new session.
- The wrapper returns `sessionID` in JSON; capture it if follow-up is likely.
- Continue with `--session <id>` and a new prompt.
- `--continue` uses the most recent session in the workspace. It is convenient
  for sequential work and unsafe for parallel work.
- `--fork` branches from the continued session without mutating it. Use it to
  try an alternative fix while preserving the original.
- Session IDs are scoped to the opencode project/workspace. Moving to another
  directory can lose access to the session.

Example repair loop:

```bash
result=$(node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --dir "$PWD" --agent build --timeout 10m --json "Implement X and run tests.")
sid=$(printf '%s' "$result" | jq -r .sessionID)

node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --dir "$PWD" --agent build --timeout 10m --json --session "$sid" \
  "The test failed with this output: ... Fix the cause and rerun."
```

## Permissions and non-interactive safety

In `run` mode there is no human to answer a permission prompt. opencode
auto-rejects calls that need approval. The rejection appears as:

```text
permission requested: external_directory (/tmp/*); auto-rejecting
```

and in JSON as a `tool_use` event whose `part.state.status` is `"error"`.

Rules of thumb:

- Keep the task inside `--dir`; that is normally allowed for `build`.
- Use `plan` for read-only tasks; it cannot edit even if prompted to.
- Use `--auto` only on a trusted workspace and only when the user authorized
  autonomous work. It does not override explicit `deny` rules.
- Better than `--auto`: define a custom agent with exactly the permissions the
  task needs, then select it with `--agent`.
- Never expose secrets in prompts. Environment variables and readable files are
  safer than pasting credentials into conversation history.

## JSON event stream

`--format json` emits one JSON object per line. Common event types:

```json
{"type":"step_start","sessionID":"ses_...","part":{"type":"step-start"}}
{"type":"tool_use","sessionID":"ses_...","part":{"type":"tool","tool":"write","state":{"status":"completed","input":{},"output":"..."}}}
{"type":"text","sessionID":"ses_...","part":{"type":"text","text":"final answer"}}
{"type":"step_finish","sessionID":"ses_...","part":{"type":"step-finish","reason":"stop","tokens":{"input":0,"output":0,"reasoning":0,"cache":{"read":0,"write":0}},"cost":0}}
```

There can be multiple steps per run. A step that calls tools ends with
`reason: "tool-calls"`; the final step ends with `"stop"`. The wrapper takes
the **last assistant message** as the result and keeps all text as `allText`.

Tool errors are not always fatal to the process. Detect them from
`tool_use.part.state.status === "error"` (or a populated `state.error`), not
from the process exit code.

Occasional non-JSON lines (permission notices, warnings) can appear on stdout.
The wrapper separates them into `notices`; a direct consumer should ignore or
log lines that do not start with `{`.

## Exit codes and failure detection

`opencode run` can exit `0` even when a tool call was rejected. This is the
single most important trap for headless use.

The wrapper treats these as failure:

- non-zero process exit
- termination by signal
- timeout
- any `type: "error"` event or error step
- a **permission** tool error by default
- any tool error when `--strict-tool-errors` is set
- no final assistant text
- a provider usage/rate-limit message in the log stream (`status:
  "quota_exceeded"`, `exitCode 75`) — the wrapper kills the worker itself
  here instead of waiting for `--timeout`, since the raw CLI never exits on
  its own after this error

Non-permission tool errors (for example, a probe read of a missing file) are
reported in `toolErrors` but do not fail a run that produced final text. This
keeps benign exploration from creating false failures while still catching the
dangerous case: a permission rejection that prevented the task. Use
`--strict-tool-errors` for failure-free semantics, or `--allow-tool-errors` to
ignore permission failures too.

If you must call `opencode run` directly:

```bash
set -o pipefail
opencode run --format json ... | tee /tmp/run.jsonl
status=$?
# Then inspect /tmp/run.jsonl for tool state errors and final text.
```

Do not trust `$?` alone.

## Parallel workers

```bash
run_one() {
  node "<skill-dir>/scripts/opencode-subagent.mjs" \
    --dir "$PWD" --agent plan --timeout 10m --json "$1" \
    > "$2"
}

run_one "Review src/auth. Do not edit files." /tmp/auth.json &
p1=$!
run_one "Review src/payments. Do not edit files." /tmp/payments.json &
p2=$!
wait "$p1" "$p2"
```

- Keep concurrency at 2–4 unless the provider allows more.
- Parallel build workers must use disjoint files or separate git worktrees.
- Do not use `--continue` in parallel; sessions collide.
- Give each worker a timeout.
- Aggregate `ok`, `text`, and `errors` from each JSON result; do not merge raw
  event streams.

## Remote server mode

Start a server:

```bash
opencode serve --port 4096
```

Run against it:

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --attach "http://localhost:4096" \
  --dir "/srv/project" \
  --agent build --json \
  "Run the test suite and summarize failures."
```

With a password, set `OPENCODE_SERVER_PASSWORD` in the environment of the
wrapper process; opencode reads it by default. Avoid putting secrets directly
in shell history.

## Kilo and other CLI-compatible forks

Kilo's `run` interface is compatible with opencode's. Select it with:

```bash
node "<skill-dir>/scripts/opencode-subagent.mjs" \
  --bin kilo --dir . --agent plan --json "Reply with READY"
```

or set `OPENCODE_SUBAGENT_BIN=kilo`. Model IDs come from `kilo models` and
usually include a `kilo/` namespace. Binary-specific flags that opencode does
not have (for example `--share` or `--cloud-fork`) are not exposed by the
wrapper; use the native CLI if you need them.

## Troubleshooting

### `cannot find "opencode" on PATH`

Install opencode, or pass `--bin /absolute/path/to/opencode`. The wrapper also
honors `OPENCODE_BIN` and `OPENCODE_SUBAGENT_BIN`.

### Workspace does not exist

`--dir` is resolved relative to the parent's cwd. Pass an absolute path if the
parent is not launched from the repository root.

### `permission requested ... auto-rejecting`

The worker needs approval. Run inside the workspace, select an agent with the
needed permissions, or use `--auto` when authorized.

### Model or variant rejected

Re-run `opencode models --verbose` and copy the exact ID and a key from that
model's `variants`. Effort is not portable across models.

### Worker hangs

Set `--timeout`. The wrapper sends `SIGTERM` to the worker's process group and
then `SIGKILL` after three seconds. Check the `--log` file for the last event.

### Worker exits 0 but does nothing

The wrapper returns `ok: false` with `errors: ["the worker produced no final
text"]`. Inspect `toolErrors` and `notices`, then retry with a tighter brief or
continue the session.

### Session not found

The session belongs to a different workspace or binary. Run `--dir` explicitly
and keep the same `--bin`. Start a new session if the old one is gone.

### Worker hangs with no output at all, then the wrapper reports `quota_exceeded`

This is expected, not a wrapper bug. opencode writes "Free usage limit
reached" / rate-limit errors only to its own log stream and then hangs
forever instead of exiting — raw `opencode run` would sit there with zero
stdout/stderr output until killed. The wrapper always enables the
equivalent of `--print-logs` internally so it can see this message, and
kills the worker as soon as it appears rather than waiting out `--timeout`.
Treat the result as retry-later, not failed: check `sessionID` and any
partial `text`/workspace changes before deciding how to proceed. If you call
the raw CLI directly instead of the wrapper, pass `--print-logs` yourself or
you will get no diagnostic at all.
