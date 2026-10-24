#!/usr/bin/env bash
# validate-plugin.sh
#
# Reads .claude-plugin/plugin.json (relative to the repo root this script
# lives in) and checks that every path listed in its "agents", "commands",
# and "skills" arrays exists on disk. Exits 0 if all exist, exits 1 with
# the missing paths listed on stderr otherwise.

set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
manifest="$repo_root/.claude-plugin/plugin.json"

if [[ ! -f "$manifest" ]]; then
  echo "validate-plugin.sh: manifest not found: $manifest" >&2
  exit 1
fi

missing=()

if command -v jq >/dev/null 2>&1; then
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    if [[ ! -e "$repo_root/$path" ]]; then
      missing+=("$path")
    fi
  done < <(jq -r '(.agents // []) + (.commands // []) + (.skills // []) | .[]' "$manifest")
else
  # Portable grep/sed fallback: extract string values from the agents,
  # commands, and skills arrays.
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    if [[ ! -e "$repo_root/$path" ]]; then
      missing+=("$path")
    fi
  done < <(
    awk '
      /"(agents|commands|skills)"[[:space:]]*:/ { in_array=1; next }
      in_array && /\]/ { in_array=0; next }
      in_array {
        line=$0
        gsub(/^[[:space:]]*"/, "", line)
        gsub(/",?[[:space:]]*$/, "", line)
        if (line != "") print line
      }
    ' "$manifest"
  )
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "validate-plugin.sh: missing paths listed in plugin.json:" >&2
  for path in "${missing[@]}"; do
    echo "  - $path" >&2
  done
  exit 1
fi

exit 0
