#!/usr/bin/env bash
# validate-plugin.sh
#
# Claude Code auto-discovers agents, commands, and skills from the standard
# agents/, commands/, and skills/ directories, so plugin.json no longer
# lists them explicitly. This script instead verifies those directories
# exist and are non-empty, and (if the `claude` CLI is available on PATH)
# shoots out to `claude plugin validate .` for full manifest validation.
# Exits 0 if all checks pass, exits 1 with details on stderr otherwise.

set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

manifest="$repo_root/.claude-plugin/plugin.json"
if [[ ! -f "$manifest" ]]; then
  echo "validate-plugin.sh: manifest not found: $manifest" >&2
  exit 1
fi

failed=0

for dir in agents commands skills; do
  path="$repo_root/$dir"
  if [[ ! -d "$path" ]]; then
    echo "validate-plugin.sh: missing standard directory: $dir/" >&2
    failed=1
    continue
  fi
  if [[ -z "$(find "$path" -mindepth 1 -print -quit)" ]]; then
    echo "validate-plugin.sh: standard directory is empty: $dir/" >&2
    failed=1
  fi
done

if command -v claude >/dev/null 2>&1; then
  if ! (cd "$repo_root" && claude plugin validate .); then
    echo "validate-plugin.sh: 'claude plugin validate .' failed" >&2
    failed=1
  fi
else
  echo "validate-plugin.sh: 'claude' CLI not found on PATH; skipping 'claude plugin validate .'" >&2
fi

exit "$failed"
