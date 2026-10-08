#!/usr/bin/env bash
# PostToolUse hook: type-check after an agent edits a TypeScript file.
# Quiet on success; on failure prints errors to stderr and exits 2 so the
# agent sees them.
set -u

input=$(cat)
file=$(printf '%s' "$input" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try { process.stdout.write(JSON.parse(s).tool_input?.file_path ?? ""); } catch {}
  });
')

case "$file" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
[ -d node_modules ] || exit 0

if ! output=$(npx --no-install tsc --noEmit 2>&1); then
  printf 'Type check failed:\n%s\n' "$output" >&2
  exit 2
fi
exit 0
