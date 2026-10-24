#!/usr/bin/env node
/**
 * Headless opencode worker.
 *
 * Runs `opencode run --format json`, aggregates the event stream, and returns
 * either the final assistant text or a structured JSON result. Works with any
 * opencode-compatible CLI (for example `kilo`) via --bin.
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  fstatSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const VERSION = "0.1.0";
const IS_WINDOWS = process.platform === "win32";

// Ranked best-to-worst for a "planner writes the spec, this model executes
// the file edits" worker role. Source: docs/opencode-free-models-coding-report.md
// (independently-verified SWE-bench/LiveBench coding scores first, vendor-only
// claims and trust-questioned models last). Used only when the caller does not
// pass --model: each is tried in order until one completes, falling through on
// quota_exceeded or any other failure.
const DEFAULT_FREE_MODELS = [
  "opencode/glm-5.3-flash-free",
  "opencode/deepseek-v4.1-flash-free",
  "opencode/beam-free",
  "opencode/nemotron-3.5-super-vl-free",
  "opencode/big-pickle",
  "opencode/mimo-v2.6-flash-free",
  "opencode/nemotron-3-ultra-free",
  "opencode/flint-40b-free",
  "opencode/nemotron-3.5-lightning-free",
];

const HELP = `opencode-subagent ${VERSION}

Run a headless opencode worker and return a clean result.

Usage:
  opencode-subagent [options] [--] <prompt...>
  echo "<prompt>" | opencode-subagent --stdin [options]

Core options:
  --dir, --cwd <path>       Workspace directory (passed to opencode --dir)
  --agent <name>            Agent: plan, build, general, explore, or a custom agent
  -m, --model <p/m>         Model as provider/model (see: opencode models).
                            Omit to auto-fallback across a ranked list of free
                            opencode/*-free models, switching on failure/quota.
  --effort, --variant <v>   Reasoning effort: minimal, low, medium, high, xhigh, max
  -s, --session <id>        Continue a specific session
  -c, --continue            Continue the last session in the workspace
  --fork                    Fork before continuing (needs --session or --continue)
  -f, --file <path>         Attach a file (repeatable)
  --title <text>            Session title

Execution:
  --timeout <dur>           Kill the worker after 30, 90s, 10m, 1h (default: off)
  --auto                    Auto-approve non-denied permissions (dangerous)
  --thinking                Show thinking blocks in the event stream
  --pure                    Run without external plugins
  --attach <url>            Attach to a running opencode server
  --port <n>                Port for the local server
  --command <name>          Run an opencode command template
  --log-level <level>       DEBUG, INFO, WARN, ERROR
  --print-logs              No-op; opencode logs are always captured now
                            (needed to detect quota/limit errors)

Output:
  --json                    Print a structured result object
  --raw                     Print raw opencode JSONL events
  --format <mode>           text (default), json, or raw
  --log <path>              Save raw JSONL events to a file
  --allow-tool-errors       Ignore all tool errors, including permission failures
  --strict-tool-errors      Fail when any tool call errors, not just permissions
  --verbose                 Metadata and captured stderr on stderr
  --dry-run                 Print the opencode command without running it
  --stdin                   Read the prompt from stdin
  -h, --help                Show this help
  --version                 Show the wrapper version

Worker selection:
  --bin <name|path>         opencode (default), kilo, or an explicit binary path
                            Also reads OPENCODE_SUBAGENT_BIN or OPENCODE_BIN.

Examples:
  opencode-subagent --dir . --agent build --timeout 10m \\
    "Add tests for src/parser.ts and run the test suite."

  opencode-subagent --dir . --agent plan --json --model provider/model \\
    --effort high "Review the auth flow. Do not edit files."

  opencode-subagent --dir . --agent build --json --session ses_abc123 \\
    "The test still fails. Fix it and rerun."
`;

function fail(message, code = 2) {
  process.stderr.write(`opencode-subagent: ${message}\n`);
  process.exit(code);
}

function parseDuration(value) {
  if (value === undefined || value === null || value === "") return 0;
  const text = String(value).trim().toLowerCase();
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000);
  const match = text.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!match) {
    fail(`invalid duration "${value}" (use 30, 90s, 10m, or 1h)`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const factor = unit === "ms" ? 1 : unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000;
  return Math.round(amount * factor);
}

function shellQuote(value) {
  if (value === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function canReadStdin() {
  try {
    const stat = fstatSync(0);
    return stat.isFIFO() || stat.isFile();
  } catch {
    return false;
  }
}

function stripAnsi(value) {
  return String(value).replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g,
    "",
  );
}

function truncate(value, max = 16_384) {
  const text = String(value ?? "");
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated]`;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function eventError(event) {
  const candidate = event?.error ?? event?.part?.error ?? event?.part?.state?.error;
  if (!candidate) return null;
  if (typeof candidate === "string") return candidate;
  return candidate.message || candidate.name || safeJson(candidate);
}

function collectToolError(event) {
  if (event?.type !== "tool_use") return null;
  const part = event.part;
  if (!part) return null;
  const state = part.state;
  if (!state) return null;
  if (state.status !== "error" && !state.error) return null;
  const input = state.input && typeof state.input === "object" ? state.input : undefined;
  const message = eventError(event) || "tool call failed";
  return {
    tool: part.tool || "unknown",
    message,
    permission: /permission|auto-reject/i.test(message),
    input: input ? truncate(safeJson(input), 4_000) : undefined,
  };
}

function makeUsage() {
  return {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
    cost: 0,
  };
}

function addUsage(usage, part) {
  const tokens = part?.tokens;
  if (!tokens) return;
  usage.input += Number(tokens.input || 0);
  usage.output += Number(tokens.output || 0);
  usage.reasoning += Number(tokens.reasoning || 0);
  usage.cacheRead += Number(tokens.cache?.read || 0);
  usage.cacheWrite += Number(tokens.cache?.write || 0);
  usage.total += Number(tokens.total || 0);
  usage.cost += Number(part.cost || 0);
}

function killTree(child, signal) {
  if (!child || child.killed) return;
  if (IS_WINDOWS) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.on("error", () => {
      try {
        child.kill(signal);
      } catch {
        // ignore
      }
    });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
}

function parseCli() {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      strict: true,
      options: {
        bin: { type: "string" },
        dir: { type: "string" },
        cwd: { type: "string" },
        agent: { type: "string" },
        model: { type: "string", short: "m" },
        effort: { type: "string" },
        variant: { type: "string" },
        session: { type: "string", short: "s" },
        continue: { type: "boolean", short: "c" },
        fork: { type: "boolean" },
        file: { type: "string", multiple: true, short: "f" },
        title: { type: "string" },
        timeout: { type: "string" },
        auto: { type: "boolean" },
        thinking: { type: "boolean" },
        pure: { type: "boolean" },
        attach: { type: "string" },
        port: { type: "string" },
        command: { type: "string" },
        "log-level": { type: "string" },
        "print-logs": { type: "boolean" },
        json: { type: "boolean" },
        raw: { type: "boolean" },
        format: { type: "string" },
        log: { type: "string" },
        "allow-tool-errors": { type: "boolean" },
        "strict-tool-errors": { type: "boolean" },
        verbose: { type: "boolean" },
        "dry-run": { type: "boolean" },
        stdin: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean" },
      },
    });
  } catch (error) {
    fail(error.message);
  }

  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
  }

  if (values.dir && values.cwd && resolve(values.dir) !== resolve(values.cwd)) {
    fail("use either --dir or --cwd, not both with different values");
  }
  const dir = values.dir || values.cwd;

  if (values.continue && values.session) {
    fail("use either --continue or --session, not both");
  }
  if (values.fork && !values.continue && !values.session) {
    fail("--fork requires --continue or --session");
  }
  if (values.effort && values.variant && values.effort !== values.variant) {
    fail("use either --effort or --variant, not both with different values");
  }
  if (values.json && values.raw) {
    fail("use either --json or --raw, not both");
  }
  if (values["allow-tool-errors"] && values["strict-tool-errors"]) {
    fail("use either --allow-tool-errors or --strict-tool-errors, not both");
  }

  let format = values.format || "text";
  if (!["text", "json", "raw"].includes(format)) {
    fail(`invalid --format "${format}" (expected text, json, or raw)`);
  }
  if (values.json) format = "json";
  if (values.raw) format = "raw";
  if (values.format && (values.json || values.raw) && values.format !== format) {
    fail("--format conflicts with --json/--raw");
  }

  let prompt = positionals.join(" ").trim();
  if (values.stdin) {
    if (prompt) fail("do not pass both --stdin and a positional prompt");
    prompt = readFileSync(0, "utf8").trim();
  } else if (!prompt && !process.stdin.isTTY && canReadStdin()) {
    prompt = readFileSync(0, "utf8").trim();
  }
  if (!prompt) fail("missing prompt; pass it as an argument or use --stdin");

  const timeoutMs = parseDuration(values.timeout);
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 0)) {
    fail(`invalid --port "${values.port}"`);
  }

  const files = (values.file || []).map((file) => resolve(file));
  const localDir = dir ? resolve(dir) : process.cwd();
  if (!values.attach && dir) {
    if (!existsSync(localDir)) fail(`workspace does not exist: ${localDir}`);
    if (!statSync(localDir).isDirectory()) fail(`workspace is not a directory: ${localDir}`);
  }

  return {
    values,
    positionals,
    prompt,
    format,
    dir,
    localDir,
    files,
    timeoutMs,
    port,
  };
}

function buildCommand(input, modelOverride) {
  const { values, prompt, files, port, dir } = input;
  const bin =
    values.bin ||
    process.env.OPENCODE_SUBAGENT_BIN ||
    process.env.OPENCODE_BIN ||
    "opencode";
  const args = ["run", "--format", "json"];

  const model = modelOverride ?? values.model;
  if (dir) args.push("--dir", dir);
  if (values.agent) args.push("--agent", values.agent);
  if (model) args.push("--model", model);
  const effort = values.effort || values.variant;
  if (effort) args.push("--variant", effort);
  if (values.session) args.push("--session", values.session);
  if (values.continue) args.push("--continue");
  if (values.fork) args.push("--fork");
  if (values.title !== undefined) args.push("--title", values.title);
  for (const file of files) args.push("--file", file);
  if (values.auto) args.push("--auto");
  if (values.thinking) args.push("--thinking");
  if (values.pure) args.push("--pure");
  if (values.attach) args.push("--attach", values.attach);
  if (port !== undefined) args.push("--port", String(port));
  if (values.command) args.push("--command", values.command);
  if (values["log-level"]) args.push("--log-level", values["log-level"]);
  // Always on: quota/limit errors are only ever written to opencode's log
  // stream, never to the run's JSON events. Without --print-logs the wrapper
  // (and the raw CLI) has no way to see why the process is hanging.
  args.push("--print-logs");
  args.push(prompt);

  return { bin, args };
}

// opencode writes quota/limit errors only to its own log stream (now mirrored
// to stderr via --print-logs), never to a JSON event or the process exit
// code. Worse, the CLI does not exit after this error — it hangs until
// killed. Detect the message as soon as it appears so the wrapper can report
// a distinct, actionable status instead of a plain timeout.
const QUOTA_PATTERN =
  /usage limit reached|quota exceeded|rate limit exceeded|too many requests|429\b.*(limit|quota)/i;

function summarize({
  ok,
  status,
  exitCode,
  signal,
  sessionID,
  text,
  allText,
  usage,
  toolErrors,
  errors,
  notices,
  stderr,
  durationMs,
  logPath,
  input,
  model,
  quotaMessage,
}) {
  return {
    ok,
    status,
    exitCode,
    signal: signal || null,
    sessionID: sessionID || null,
    agent: input.values.agent || null,
    model: model || input.values.model || null,
    effort: input.values.effort || input.values.variant || null,
    text: text || "",
    allText: allText || text || "",
    usage,
    toolErrors,
    errors,
    notices,
    quotaExceeded: Boolean(quotaMessage),
    quotaMessage: quotaMessage || null,
    stderr: stderr ? truncate(stripAnsi(stderr)) : "",
    durationMs,
    log: logPath || null,
  };
}

async function runAttempt(input, model, logPath) {
  const { values, localDir, timeoutMs, format } = input;
  const { bin, args } = buildCommand(input, model);

  const startedAt = Date.now();
  const usage = makeUsage();
  const toolErrors = [];
  const errors = [];
  const notices = [];
  const textMessages = new Map();
  let sessionID = null;
  let stdoutBuffer = "";
  let stderrBuffer = "";
  let rawLog = "";
  let timedOut = false;
  let spawnError = null;
  let killTimer = null;
  let quotaMessage = null;

  const child = spawn(bin, args, {
    cwd: values.attach ? process.cwd() : localDir,
    env: process.env,
    detached: !IS_WINDOWS,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const writeLog = (line) => {
    rawLog += `${line}\n`;
  };

  const handleEvent = (event) => {
    const eventType = event?.type || event?.part?.type;

    if (event?.sessionID && !sessionID) sessionID = event.sessionID;
    if (eventType === "text" && typeof event?.part?.text === "string") {
      const key = event.part.messageID || event.part.id || "_";
      textMessages.set(key, (textMessages.get(key) || "") + event.part.text);
    }
    if (eventType === "step_finish") {
      addUsage(usage, event.part);
      if (event?.part?.reason === "error") {
        errors.push(eventError(event) || "step finished with an error");
      }
    }
    const toolError = collectToolError(event);
    if (toolError) toolErrors.push(toolError);
    if (eventType === "error" || event?.part?.type === "error") {
      const message = eventError(event);
      if (message) errors.push(message);
    }
  };

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    if (format === "raw") process.stdout.write(chunk);
    stdoutBuffer += chunk;
    let newline;
    while ((newline = stdoutBuffer.indexOf("\n")) !== -1) {
      const line = stdoutBuffer.slice(0, newline).replace(/\r$/, "");
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line.trim()) continue;
      writeLog(line);
      const trimmed = line.trim();
      if (trimmed.startsWith("{")) {
        try {
          handleEvent(JSON.parse(trimmed));
        } catch {
          const notice = stripAnsi(trimmed);
          notices.push(notice);
          if (values.verbose) process.stderr.write(`${notice}\n`);
        }
      } else {
        const notice = stripAnsi(trimmed);
        notices.push(notice);
        if (values.verbose) process.stderr.write(`${notice}\n`);
      }
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk;
    if (stderrBuffer.length > 65_536) stderrBuffer = stderrBuffer.slice(-65_536);
    if (values.verbose) process.stderr.write(chunk);
    const clean = stripAnsi(chunk);
    if (!sessionID) {
      const sidMatch = clean.match(/session\.id=(ses_[A-Za-z0-9]+)/) || clean.match(/\bid=(ses_[A-Za-z0-9]+)/);
      if (sidMatch) sessionID = sidMatch[1];
    }
    if (!quotaMessage) {
      const match = clean.match(QUOTA_PATTERN);
      if (match) {
        const line = clean.split("\n").find((l) => QUOTA_PATTERN.test(l)) || match[0];
        quotaMessage = line.trim();
        // The CLI does not exit on its own after this error; it hangs
        // indefinitely. Stop waiting for --timeout and end the run now.
        killTree(child, "SIGTERM");
        setTimeout(() => killTree(child, "SIGKILL"), 3_000).unref();
      }
    }
  });

  const onSignal = (signal, exitCode) => {
    killTree(child, signal);
    setTimeout(() => process.exit(exitCode), 250).unref();
  };
  process.once("SIGINT", () => onSignal("SIGINT", 130));
  process.once("SIGTERM", () => onSignal("SIGTERM", 143));

  child.on("error", (error) => {
    spawnError = error;
  });

  if (timeoutMs > 0) {
    killTimer = setTimeout(() => {
      timedOut = true;
      killTree(child, "SIGTERM");
      setTimeout(() => killTree(child, "SIGKILL"), 3_000).unref();
    }, timeoutMs);
    killTimer.unref();
  }

  const exit = await new Promise((resolveExit) => {
    child.on("close", (code, signal) => resolveExit({ code, signal }));
  });
  if (killTimer) clearTimeout(killTimer);

  if (stdoutBuffer.trim()) {
    const line = stdoutBuffer.trim();
    writeLog(line);
    if (line.startsWith("{")) {
      try {
        handleEvent(JSON.parse(line));
      } catch {
        notices.push(stripAnsi(line));
      }
    } else {
      notices.push(stripAnsi(line));
    }
  }

  if (spawnError) {
    const message =
      spawnError.code === "ENOENT"
        ? `cannot find "${bin}" on PATH`
        : spawnError.message || String(spawnError);
    errors.push(message);
    fail(message, 127);
  }

  const textBlocks = [...textMessages.values()].filter(Boolean);
  const allText = textBlocks.join("\n\n").trim();
  const lastText = textBlocks.length ? textBlocks.at(-1).trim() : "";
  const finalText = lastText || allText;

  if (!timedOut && !finalText && !errors.length) {
    errors.push("the worker produced no final text");
  }
  if (toolErrors.length && !values["allow-tool-errors"]) {
    const blocking = values["strict-tool-errors"]
      ? toolErrors
      : toolErrors.filter((error) => error.permission);
    if (blocking.length) {
      const noun = blocking.length === 1 ? "tool call" : "tool calls";
      const hint = values["strict-tool-errors"]
        ? "use --allow-tool-errors to ignore"
        : "a permission failure blocks the run; use --auto or fix permissions";
      errors.push(`${blocking.length} ${noun} failed (${hint})`);
    }
  }
  if (exit.signal && !timedOut && !quotaMessage) {
    errors.push(`worker terminated by signal ${exit.signal}`);
  }
  if (quotaMessage) {
    errors.push(
      `provider usage limit hit: ${quotaMessage} — this is a quota condition, not a task ` +
        "failure. The subagent may have made partial progress before the limit was reached; " +
        "inspect the workspace (git status/diff, files mentioned in its last output) before " +
        "deciding whether to retry with a different model/provider or resume the session once " +
        "the quota resets.",
    );
  }

  const processFailed = timedOut || Boolean(exit.signal) || exit.code !== 0 || !finalText;
  const ok = !processFailed && errors.length === 0 && !quotaMessage;
  const status = quotaMessage ? "quota_exceeded" : timedOut ? "timeout" : ok ? "completed" : "failed";
  const exitCode = quotaMessage
    ? 75 // EX_TEMPFAIL: transient, retry-later condition — distinct from a hard failure
    : timedOut
      ? 124
      : ok
        ? 0
        : exit.code && exit.code !== 0
          ? exit.code
          : 1;
  const durationMs = Date.now() - startedAt;
  const result = summarize({
    ok,
    status,
    exitCode,
    signal: exit.signal,
    sessionID,
    text: finalText,
    allText,
    usage,
    toolErrors,
    errors,
    notices,
    stderr: stderrBuffer,
    durationMs,
    logPath,
    input,
    model,
    quotaMessage,
  });

  if (logPath) {
    try {
      writeFileSync(logPath, rawLog);
    } catch (error) {
      notices.push(`could not write log: ${error.message}`);
      result.notices = notices;
    }
  }

  return result;
}

function printResult(input, result) {
  const { values, format } = input;
  const { ok, status, exitCode, usage, errors, toolErrors, notices, sessionID, durationMs, log: logPath } =
    result;

  if (format === "json") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (format === "text") {
    if (result.text) process.stdout.write(`${result.text}\n`);
    if (values.verbose || !ok) {
      const details = [
        ...errors,
        ...toolErrors.map((error) => `${error.tool}: ${error.message}`),
        ...notices,
      ].filter(Boolean);
      if (details.length) process.stderr.write(`${details.join("\n")}\n`);
      if (values.verbose) {
        process.stderr.write(
          [
            `status: ${status}`,
            `model: ${result.model || "unknown"}`,
            `session: ${sessionID || "unknown"}`,
            `duration: ${(durationMs / 1000).toFixed(1)}s`,
            `cost: ${usage.cost}`,
            logPath ? `log: ${logPath}` : "",
          ]
            .filter(Boolean)
            .join("\n") + "\n",
        );
      }
    }
  } else if (!ok) {
    const details = [...errors, ...toolErrors.map((error) => `${error.tool}: ${error.message}`)];
    if (details.length) process.stderr.write(`${details.join("\n")}\n`);
  }

  process.exitCode = exitCode;
}

async function main() {
  const input = parseCli();
  const { values, localDir } = input;

  if (values["dry-run"]) {
    const { bin, args } = buildCommand(input, values.model || DEFAULT_FREE_MODELS[0]);
    const cwd = values.attach ? process.cwd() : localDir;
    process.stdout.write(`cd ${shellQuote(cwd)} && ${[bin, ...args].map(shellQuote).join(" ")}\n`);
    if (!values.model) {
      process.stderr.write(
        `opencode-subagent: no --model given; showing the first default free-model ` +
          `fallback (${DEFAULT_FREE_MODELS[0]}). A real run tries ${DEFAULT_FREE_MODELS.length} ` +
          `models in order, switching on failure.\n`,
      );
    }
    return;
  }

  const baseLogPath = values.log ? resolve(values.log) : null;
  if (baseLogPath) {
    try {
      mkdirSync(dirname(baseLogPath), { recursive: true });
    } catch (error) {
      fail(`cannot create log directory: ${error.message}`);
    }
  }

  // If the caller pinned a model with --model, never substitute another one —
  // only fall back across the ranked free-model list when the model was left
  // unspecified (see DEFAULT_FREE_MODELS above).
  const candidates = values.model ? [values.model] : DEFAULT_FREE_MODELS;

  const attempts = [];
  let result = null;
  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    const logPath = baseLogPath && candidates.length > 1 ? `${baseLogPath}.${i}-${model.replace(/[^\w.-]+/g, "_")}` : baseLogPath;
    if (values.verbose && candidates.length > 1) {
      process.stderr.write(`opencode-subagent: attempt ${i + 1}/${candidates.length} with model ${model}\n`);
    }
    // eslint-disable-next-line no-await-in-loop
    result = await runAttempt(input, model, logPath);
    attempts.push({ model, status: result.status, ok: result.ok });
    if (result.ok) break;
    const retryable = result.status === "quota_exceeded" || result.status === "failed" || result.status === "timeout";
    if (!retryable || i === candidates.length - 1) break;
  }

  if (attempts.length > 1) {
    result.notices = [
      ...(result.notices || []),
      `tried ${attempts.length} free models in order before stopping: ` +
        attempts.map((a) => `${a.model} (${a.status})`).join(" -> "),
    ];
  }
  result.attempts = attempts;

  printResult(input, result);
}

main().catch((error) => {
  process.stderr.write(`opencode-subagent: ${error?.stack || error}\n`);
  process.exit(1);
});
