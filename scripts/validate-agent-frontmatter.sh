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
  local key_line_num
  local value

  # Find the line number of a top-level "key:" line, allowing leading whitespace.
  key_line_num="$(printf '%s\n' "$frontmatter" | grep -nE "^[[:space:]]*${key}:" | head -n1 | cut -d: -f1)"

  if [[ -z "$key_line_num" ]]; then
    echo "validate-agent-frontmatter.sh: $file: missing key '${key}'" >&2
    return 1
  fi

  local key_line
  key_line="$(printf '%s\n' "$frontmatter" | sed -n "${key_line_num}p")"

  # Strip "key:" prefix and surrounding whitespace/quotes to check for a same-line value.
  value="${key_line#*:}"
  value="$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^['\"]//" -e "s/['\"]\$//")"

  if [[ -n "$value" ]]; then
    return 0
  fi

  # No same-line value: check for a YAML block-list value on the following
  # indented "- " lines, e.g.:
  #   tools:
  #     - Read
  #     - Write
  local next_line_num=$((key_line_num + 1))
  local next_line
  next_line="$(printf '%s\n' "$frontmatter" | sed -n "${next_line_num}p")"

  if [[ "$next_line" =~ ^[[:space:]]+-[[:space:]]*.+ ]]; then
    return 0
  fi

  echo "validate-agent-frontmatter.sh: $file: key '${key}' is empty" >&2
  return 1
}

for key in name description model tools; do
  if ! check_key "$key"; then
    exit 1
  fi
done

exit 0
