#!/usr/bin/env bash
# run-phase.sh NAME PROMPTFILE MINUTES — one fresh headless OpenCode session for one phase.
set -u
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
cd /home/mkadm/repos/coder-shop || exit 1
log="/home/mkadm/repos/coder-shop-logs/$1"; mkdir -p "$(dirname "$log")"
echo "$(date +%T) start $1" >>/home/mkadm/repos/coder-shop-logs/timeline.txt
timeout --signal=INT --kill-after=60 "$(( $3 * 60 ))" opencode run --auto --format json --title "$1" "$(cat "$2")" \
  >"$log.jsonl" 2>"$log.err"
echo "$(date +%T) end $1 rc=$?" >>/home/mkadm/repos/coder-shop-logs/timeline.txt
