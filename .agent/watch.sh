#!/usr/bin/env bash
# .agent/watch.sh — follow the agent live: every phase's file writes and edits, the commands it
# runs (with their exit), and what it says, from the OpenCode event streams in .agent/logs/.
# Read-only; Ctrl-C ends it.
set -uo pipefail
cd "$(dirname "$0")/logs" || exit 1
touch timeline.txt
tail -n +1 -F timeline.txt ./*.jsonl 2>/dev/null | while IFS= read -r line; do
  case "$line" in
    '==> '*) ;;
    [0-9][0-9]:*) printf '\n\033[1;36m⏱  %s\033[0m\n' "$line" ;;
    '{'*)
      jq -r --unbuffered '
        def short: tostring | gsub("\n"; " ⏎ ") | .[0:150];
        if .part.type == "tool" and .part.state.status == "completed" then
          if .part.tool == "write" then "\u001b[32m  ✚ write \(.part.state.input.filePath | sub(".*/coder-shop/"; ""))\u001b[0m"
          elif .part.tool == "edit" then "\u001b[33m  ✎ edit  \(.part.state.input.filePath | sub(".*/coder-shop/"; ""))\u001b[0m"
          elif .part.tool == "bash" then "\u001b[35m  $ \(.part.state.input.command | short)\u001b[0m"
          elif .part.tool == "read" then "\u001b[2m  · read  \(.part.state.input.filePath // "" | sub(".*/coder-shop/"; ""))\u001b[0m"
          else "\u001b[2m  · \(.part.tool) \(.part.state.title // "" | short)\u001b[0m" end
        elif .part.type == "text" and (.part.text // "") != "" then "\u001b[37m  💬 \(.part.text | short)\u001b[0m"
        else empty end' <<<"$line" 2>/dev/null ;;
  esac
done
