#!/usr/bin/env bash
# validate-agent-frontmatter.sh <path-to-agent-md>
#
# Extracts the YAML frontmatter block (between the first two `---` lines)
# of an agent markdown file and checks for non-empty `name`, `description`,
# `model`, and `tools` keys. Exits 0 if all present and non-empty, exits 1
# with a one-line message to stderr naming the missing key otherwise.

set -u

file="${1:-}"

if [[ -z "$file" ]]; then
  echo "validate-agent-frontmatter.sh: missing required argument <path-to-agent-md>" >&2
  exit 1
fi

if [[ ! -f "$file" ]]; then
  echo "validate-agent-frontmatter.sh: file not found: $file" >&2
  exit 1
fi

# Extract content between the first two '---' lines.
frontmatter="$(awk '
  /^---[[:space:]]*$/ {
    count++
    if (count == 1) { next }
    if (count == 2) { exit }
  }
  count == 1 { print }
' "$file")"

if [[ -z "$frontmatter" ]]; then
  echo "validate-agent-frontmatter.sh: $file: no YAML frontmatter block found" >&2
  exit 1
fi

check_key() {
  local key="$1"
  local value
  # Match a top-level "key: value" line, allowing leading whitespace.
  value="$(printf '%s\n' "$frontmatter" | grep -E "^[[:space:]]*${key}:" | head -n1)"

  if [[ -z "$value" ]]; then
    echo "validate-agent-frontmatter.sh: $file: missing key '${key}'" >&2
    return 1
  fi

  # Strip "key:" prefix and surrounding whitespace/quotes to check for emptiness.
  value="${value#*:}"
  value="$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^['\"]//" -e "s/['\"]\$//")"

  if [[ -z "$value" ]]; then
    echo "validate-agent-frontmatter.sh: $file: key '${key}' is empty" >&2
    return 1
  fi

  return 0
}

for key in name description model tools; do
  if ! check_key "$key"; then
    exit 1
  fi
done

exit 0
