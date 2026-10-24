# Installing the skill across harnesses

The skill is a standard folder with `SKILL.md` at its root:

```text
opencode-subagent/
├── SKILL.md
├── scripts/opencode-subagent.mjs
└── references/
```

Any harness that supports Claude-style `SKILL.md` skills can load it. The
folder name must be `opencode-subagent` so the frontmatter name matches. The
helper script is portable; only Node 18+ and the opencode CLI are required.

Restart the harness after installing. Most harnesses load skills at session
start and do not hot-reload them.

## Quick install

From the repository root:

```bash
./install.sh                 # every detected harness
./install.sh --harness claude
./install.sh --harness codex
./install.sh --dest "$HOME/.claude/skills/opencode-subagent"
./install.sh --copy --harness opencode
./install.sh --dry-run       # show what would happen
```

The installer symlinks by default, skips harnesses whose config directory does
not exist, and never replaces an existing different skill without `--force`.
`--dest` must be the **skill folder** (the directory that will contain
`SKILL.md`), not the parent skills directory.

## Paths

### opencode

Global:

```bash
mkdir -p "$HOME/.config/opencode/skills"
ln -s "$PWD/opencode-subagent" "$HOME/.config/opencode/skills/opencode-subagent"
```

Project:

```bash
mkdir -p .opencode/skills
ln -s "$PWD/opencode-subagent" .opencode/skills/opencode-subagent
```

Verify:

```bash
opencode debug skill | grep opencode-subagent
```

opencode also auto-loads `~/.claude/skills` and `~/.agents/skills`, so a Claude
or shared-agents installation may be enough. Global skills live under
`~/.config/opencode/skill(s)/`, not `~/.opencode`.

### Claude Code

Personal:

```bash
mkdir -p "$HOME/.claude/skills"
ln -s "$PWD/opencode-subagent" "$HOME/.claude/skills/opencode-subagent"
```

Project:

```bash
mkdir -p .claude/skills
ln -s "$PWD/opencode-subagent" .claude/skills/opencode-subagent
```

Start a new Claude Code session. In a skill's Bash calls, `${CLAUDE_SKILL_DIR}`
resolves to the skill folder, so the invocation can be:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/opencode-subagent.mjs" --help
```

### Codex

Personal:

```bash
mkdir -p "$HOME/.codex/skills"
ln -s "$PWD/opencode-subagent" "$HOME/.codex/skills/opencode-subagent"
```

Project (supported by current Codex builds):

```bash
mkdir -p .codex/skills
ln -s "$PWD/opencode-subagent" .codex/skills/opencode-subagent
```

Start a new Codex session. Codex's skill discovery has evolved; if the skill
does not appear, check your Codex version's configured skills directory and use
`--dest` with that path.

### OpenClaw

OpenClaw has a managed skills directory and an install command:

```bash
openclaw skills install --global "$PWD/opencode-subagent"
openclaw skills info opencode-subagent
openclaw skills list --json
```

Or use the same symlink layout OpenClaw already uses for managed skills:

```bash
mkdir -p "$HOME/.openclaw/skills"
ln -s "$PWD/opencode-subagent" "$HOME/.openclaw/skills/opencode-subagent"
```

Without `--global`, `openclaw skills install` installs into the active agent's
workspace. Use that when you want the skill available to one agent only.

### Hermes

```bash
mkdir -p "$HOME/.hermes/skills"
ln -s "$PWD/opencode-subagent" "$HOME/.hermes/skills/opencode-subagent"
```

Start a new Hermes session. Hermes uses the standard `SKILL.md` layout in
`~/.hermes/skills`.

### Kilo

Kilo is an opencode-compatible fork. Its global config root is
`~/.config/kilo` (verify with `kilo debug paths`). Install there:

```bash
mkdir -p "$HOME/.config/kilo/skills"
ln -s "$PWD/opencode-subagent" "$HOME/.config/kilo/skills/opencode-subagent"
```

Verify:

```bash
kilo debug skill | grep opencode-subagent
```

Run the worker with `--bin kilo` so model IDs and auth come from Kilo:

```bash
node "$HOME/.config/kilo/skills/opencode-subagent/scripts/opencode-subagent.mjs" \
  --bin kilo --dir . --agent plan "Reply with READY"
```

### Other harnesses

If a harness supports `SKILL.md`, install into its skills directory and restart
it. If it only supports a system prompt or command file, reference `SKILL.md`
directly from that prompt and invoke the helper script by absolute path.

## Shared agents directory

Many harnesses also scan `~/.agents/skills`. A single symlink there can serve
multiple tools:

```bash
mkdir -p "$HOME/.agents/skills"
ln -s "$PWD/opencode-subagent" "$HOME/.agents/skills/opencode-subagent"
```

Check each harness's current discovery order; duplicate installations are
harmless (the same skill name resolves to the same folder), but keep one source
of truth to avoid version drift.

## Uninstall

```bash
./install.sh --uninstall
./install.sh --uninstall --harness claude
```

Only symlinks that point at this repository are removed by default. If you
installed with `--copy`, use `--force --uninstall` after confirming the target
is the copy you want to delete.

## Without installing

The skill can be used from any directory:

```bash
SKILL_DIR=/absolute/path/to/opencode-subagent
node "$SKILL_DIR/scripts/opencode-subagent.mjs" --dir "$PWD" --agent plan "Reply with READY"
```

This is useful for testing before installing, or for harnesses that do not have
a skill directory.
