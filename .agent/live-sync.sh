#!/usr/bin/env bash
# .agent/live-sync.sh — every commit flows into the running shop: when HEAD of the repository
# changes, the live worktree is updated to it (install, build, seed, photo paths) and the shop on
# :4000 restarts on the new build. A commit that does not build leaves the running shop as it is;
# the next commit is tried again. Checks every SYNC_INTERVAL seconds (default 30).
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
LOCK="$REPO/.agent/logs/live.lock"; last=""
while :; do
  head="$(git -C "$REPO" rev-parse HEAD 2>/dev/null)"
  if [[ -n "$head" && "$head" != "$last" ]]; then
    flock "$LOCK" env DEPLOY_ONLY="$head" "$REPO/.agent/orchestrate.sh" >/dev/null 2>&1
    last="$head"      # tried; a failed build waits for the next commit
  fi
  sleep "${SYNC_INTERVAL:-30}"
done
