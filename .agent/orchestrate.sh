#!/usr/bin/env bash
# .agent/orchestrate.sh — the unattended rest of the run: milestone after milestone, each in a
# fresh OpenCode session, each followed by an automatic gate. A red gate goes back to the coder
# as a report of SYMPTOMS ONLY — the failing commands and their raw output, the git state, the
# HTTP status of the pages — never a cause or a fix. Up to MAX_ATTEMPTS sessions per milestone,
# then the run moves on and the milestone counts as not passed.
#
#   .agent/orchestrate.sh [MILESTONE...]     default: M2 M6 M3 M4 M5
#   RESUME=M2 RESUME_SINCE=<commit>          a session of M2 already ran: gate it first
#   DEADLINE=09:30 MAX_ATTEMPTS=4 SESSION_MIN=30 .agent/orchestrate.sh
#
# Log: .agent/logs/orchestrator.log (one line per step), gate details in .agent/logs/gate-*.txt.
set -uo pipefail
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
REPO="${REPO:-/home/mkadm/repos/coder-shop}"
SETUP=/home/mkadm/repos/setup-ubuntu-ai/setup.sh
LOGS="$REPO/.agent/logs"
DEADLINE="${DEADLINE:-09:30}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-4}"
SESSION_MIN="${SESSION_MIN:-30}"
GATE_PORT=3100
cd "$REPO" || exit 1
# The key is given to the coder only for M6 (the image API needs it) and to the image batch;
# a git hook (installed below) refuses any commit or push that contains it.
KEY="$(sudo -n head -1 /etc/setup-ubuntu-ai/api-key)"
BATCH_END="${BATCH_END:-10:15}"

log() { printf '%s %s\n' "$(date +%T)" "$*" | tee -a "$LOGS/orchestrator.log"; }
past_deadline() { [[ "$(date +%H:%M)" > "$DEADLINE" ]]; }
web_stop()  { systemctl --user stop coder-shop-web 2>/dev/null || true; }
web_start() {
  systemctl --user stop coder-shop-web 2>/dev/null || true
  systemd-run --user --unit=coder-shop-web --collect -p WorkingDirectory="$REPO" -E PATH="$PATH" \
    npx next start -H 0.0.0.0 -p 4000 >/dev/null 2>&1
}

# gate M — writes the symptom report to $LOGS/gate-M-attemptN.txt; returns 0 when green.
gate() {
  local m="$1" out="$2" since="$3" rc=0 pid code url
  : >"$out"
  run_check() {  # run_check NAME CMD... — append the raw output of a failing command
    local name="$1"; shift
    local tmp ec; tmp="$(mktemp)"
    timeout 900 "$@" >"$tmp" 2>&1; ec=$?
    if (( ec == 0 )); then rm -f "$tmp"; return 0; fi
    { printf '`%s` failed (exit %s), last lines of its output:\n```\n' "$name" "$ec"
      grep -v '^\s*$' "$tmp" | tail -60; printf '```\n'; } >>"$out"
    rm -f "$tmp"; return 1
  }
  run_check "npm test" npm test || rc=1
  run_check "npm run lint" npm run lint || rc=1
  run_check "npm run build" npm run build || rc=1
  if [[ "$m" == QA || "$m" == ISSUES ]]; then run_check "npm run test:e2e" npm run test:e2e || rc=1; fi
  if (( rc == 0 )); then
    # its own process group, so stopping it also stops next-server and the mongod it started
    setsid npx next start -p "$GATE_PORT" >"$LOGS/gate-server.log" 2>&1 & pid=$!
    for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$GATE_PORT/" && break; sleep 1; done
    for url in / /produkte /api/health; do
      code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "http://127.0.0.1:$GATE_PORT$url")"
      [[ "$code" == 200 ]] || { echo "GET $url → HTTP $code" >>"$out"; rc=1; }
    done
    if ! curl -s --max-time 30 "http://127.0.0.1:$GATE_PORT/produkte" | grep -q '/produkt/'; then
      echo "GET /produkte → the HTML links to no product page (/produkt/…)" >>"$out"; rc=1
    fi
    if grep -qiE 'error|unhandled|ECONNREFUSED' "$LOGS/gate-server.log"; then
      { printf 'the server logged errors while these pages were fetched (last lines):\n```\n'
        grep -v '^\s*$' "$LOGS/gate-server.log" | tail -30; printf '```\n'; } >>"$out"; rc=1
    fi
    kill -TERM -- -"$pid" 2>/dev/null
    for _ in $(seq 1 15); do kill -0 -- -"$pid" 2>/dev/null || break; sleep 1; done
    kill -KILL -- -"$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "git status: $(git status --porcelain | wc -l) uncommitted file(s)" >>"$out"; rc=1
  fi
  if [[ "$m" == ISSUES ]]; then
    [[ -n "$(git log --oneline "$since..HEAD")" ]] || { echo "git log: no commit since this session started" >>"$out"; rc=1; }
  elif ! git log --format=%s "$since..HEAD" | grep -q "^$m:"; then
    echo "git log: no commit \"$m: …\" since this milestone started" >>"$out"; rc=1
  fi
  git fetch -q origin 2>/dev/null
  if [[ -n "$(git log --oneline origin/main..main 2>/dev/null)" ]]; then
    echo "git: $(git log --oneline origin/main..main | wc -l) commit(s) not pushed" >>"$out"; rc=1
  fi
  return "$rc"
}

prompt_for() {  # prompt_for M GATEFILE OUT
  local m="$1" gatef="$2" outp="$3" report="(none — first session of $1)"
  [[ -s "$gatef" ]] && report="$(cat "$gatef")"
  case "$m" in
    M6) cp .agent/prompts/6-images.md "$outp" ;;
    QA) cp .agent/prompts/qa.md "$outp" ;;
    ISSUES) cp .agent/prompts/issues.md "$outp" ;;
    *)  sed "s|{{M}}|$m|g" .agent/prompts/4-milestone.md >"$outp" ;;
  esac
  python3 - "$outp" "$report" <<'PY'
import sys; p, r = sys.argv[1], sys.argv[2]
s = open(p).read().replace("{{GATE}}", r); open(p, "w").write(s)
PY
}

strata_with_images() {
  log "restart strata-server so the image engine is active (setup.sh service restart)"
  # shellcheck disable=SC2024  # the log is ours, written as us
  sudo -n "$SETUP" --no-ui -y service restart >>"$LOGS/orchestrator.log" 2>&1 \
    || log "service restart reported a problem (see above)"
}

milestone() {
  local m="$1" attempt since gatef="" prompt first=1
  since="$(git rev-parse HEAD)"
  if [[ "${RESUME:-}" == "$m" ]]; then          # its first session already ran: gate it
    since="${RESUME_SINCE:-$since}"; gatef="$LOGS/gate-$m-1.txt"; first=2
    if gate "$m" "$gatef" "$since"; then log "$m (session 1, started by hand): GATE GREEN"; web_start; return 0; fi
    log "$m (session 1, started by hand): gate red — $(grep -c . "$gatef") report line(s) go to the next session"
  fi
  for attempt in $(seq "$first" "$MAX_ATTEMPTS"); do
    past_deadline && { log "$m: deadline $DEADLINE reached, not starting attempt $attempt"; return 1; }
    prompt="$LOGS/$m-$attempt-prompt.md"; prompt_for "$m" "$gatef" "$prompt"
    web_stop
    log "$m attempt $attempt: coder session (≤ ${SESSION_MIN} min)"
    if [[ "$m" == M6 ]]; then
      LLAMA_API_KEY="$KEY" "$REPO/.agent/prompts/run-phase.sh" "$m-$attempt" "$prompt" "$SESSION_MIN"
    else
      env -u LLAMA_API_KEY "$REPO/.agent/prompts/run-phase.sh" "$m-$attempt" "$prompt" "$SESSION_MIN"
    fi
    gatef="$LOGS/gate-$m-$attempt.txt"
    if gate "$m" "$gatef" "$since"; then
      log "$m attempt $attempt: GATE GREEN"
      web_start; return 0
    fi
    log "$m attempt $attempt: gate red — $(grep -c . "$gatef") report line(s) go to the next session"
    web_start
  done
  log "$m: not passed after $MAX_ATTEMPTS sessions"
  return 1
}

# session EFFORT NAME PROMPTFILE MINUTES — one OpenCode session at a reasoning effort (high for
# planning and reviewing, medium for building); inline config overrides the project's opencode.json.
session() {
  local cfg='{"provider":{"llm":{"models":{"llm-qwen3.8-flash-next-unsloth-ud-q5_k_xl":{"options":{"reasoningEffort":"'"$1"'"}}}}}}'
  env -u LLAMA_API_KEY GH_REPO="$GH_REPO" OPENCODE_CONFIG_CONTENT="$cfg" "$REPO/.agent/prompts/run-phase.sh" "$2" "$3" "$4"
}

# issues_loop — sessions on the GitHub issue queue of this repository until it is empty; each
# session is gated like a milestone, a red gate goes into the next session's prompt.
issues_loop() {
  local n=0 since gatef="" prompt open
  while :; do
    open="$(gh issue list -R "$GH_REPO" --state open --limit 200 --json number --jq length 2>/dev/null)"
    log "ISSUES: ${open:-?} open"
    [[ "${open:-1}" == 0 ]] && { log "ISSUES: queue empty"; break; }
    (( n >= ${ISSUE_SESSIONS:-12} )) && { log "ISSUES: session limit reached"; break; }
    past_deadline && { log "ISSUES: deadline $DEADLINE reached"; break; }
    n=$((n + 1)); since="$(git rev-parse HEAD)"
    web_stop
    log "ISSUES round $n: plan (effort high, ≤ ${PLAN_MIN:-15} min)"
    session high "ISSUES-$n-plan" "$REPO/.agent/prompts/issues-plan.md" "${PLAN_MIN:-15}"
    prompt="$LOGS/ISSUES-$n-prompt.md"; prompt_for ISSUES "$gatef" "$prompt"
    log "ISSUES round $n: build (effort medium, ≤ ${SESSION_MIN} min)"
    session medium "ISSUES-$n" "$prompt" "$SESSION_MIN"
    gatef="$LOGS/gate-ISSUES-$n.txt"
    if gate ISSUES "$gatef" "$since"; then log "ISSUES round $n: GATE GREEN"; : >"$gatef"
    else log "ISSUES round $n: gate red — $(grep -c . "$gatef") report line(s) go to the next build"; fi
    sed "s|{{SINCE}}|$since|g" "$REPO/.agent/prompts/issues-review.md" >"$LOGS/ISSUES-$n-review-prompt.md"
    log "ISSUES round $n: review (effort high, ≤ ${REVIEW_MIN:-15} min)"
    session high "ISSUES-$n-review" "$LOGS/ISSUES-$n-review-prompt.md" "${REVIEW_MIN:-15}"
    { [[ -s "$gatef" ]] && cat "$gatef"; jq -r 'select(.part.type=="text") | .part.text' "$LOGS/ISSUES-$n-review.jsonl" 2>/dev/null | tail -1 | sed '1s/^/Findings of the review session:\n/'; } >"$gatef.next"
    mv "$gatef.next" "$gatef"
    log "ISSUES round $n: review done — $(gh issue list -R "$GH_REPO" --state open --limit 200 --json number --jq length) open"
    web_start
  done
}

image_batch() {
  local n before after
  before="$(find public/products -type f \( -name '*.webp' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' \) | wc -l)"
  log "images: full batch starts ($before photo files present); the LLM is unloaded meanwhile"
  web_stop
  local left; left=$(( $(date -d "$BATCH_END" +%s) - $(date +%s) ))
  (( left > 600 )) || { log "images: too close to $BATCH_END for a batch"; web_start; return; }
  for n in 1 2 3; do
    left=$(( $(date -d "$BATCH_END" +%s) - $(date +%s) )); (( left > 300 )) || break
    LLAMA_API_KEY="$KEY" timeout "$left" npm run images >"$LOGS/images-batch-$n.log" 2>&1 && break
    log "images: run $n ended with an error (log images-batch-$n.log), restarting — finished images are skipped"
    past_deadline && break
  done
  after="$(find public/products -type f \( -name '*.webp' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' \) | wc -l)"
  log "images: batch done, $after photo files (was $before)"
  npm run build >"$LOGS/images-build.log" 2>&1 || log "images: build after the batch failed (images-build.log)"
  web_start
}

# GATE_ONLY=<M> GATE_SINCE=<commit>: just run the gate once and print its report (a self-test).
if [[ -n "${GATE_ONLY:-}" ]]; then
  if gate "$GATE_ONLY" "$LOGS/gate-selftest.txt" "${GATE_SINCE:-HEAD~1}"; then echo GREEN; else echo RED; fi
  cat "$LOGS/gate-selftest.txt"; exit 0
fi

# Never let the API key into the (public) history: a hook refuses commits and pushes with it.
for hook in pre-commit pre-push; do
  cat >".git/hooks/$hook" <<'HOOK'
#!/bin/sh
key="$(sudo -n head -1 /etc/setup-ubuntu-ai/api-key 2>/dev/null)"
[ -n "$key" ] || exit 0
if [ "$(basename "$0")" = pre-commit ]; then git diff --cached -U0 | grep -qF -- "$key"; else git log -p origin/main..HEAD 2>/dev/null | grep -qF -- "$key"; fi \
  && { echo "refused: the server's API key is in this change — keep it in the environment, never in files" >&2; exit 1; }
exit 0
HOOK
  chmod +x ".git/hooks/$hook"
done

log "orchestrator start: milestones ${*:-M2 M6 M3 M4 M5} (default order), deadline $DEADLINE, image batch until $BATCH_END, ≤ $MAX_ATTEMPTS sessions × $SESSION_MIN min"
# a session already running (started by hand) finishes first
while systemctl --user is-active --quiet coder-shop-m2; do sleep 20; done
export GH_REPO="${GH_REPO:-kartalbas/coder-shop}"
ms=("$@"); (( ${#ms[@]} )) || ms=(M2 M6 M3 M4 M5)
for m in "${ms[@]}"; do
  if [[ "$m" == ISSUES ]]; then issues_loop; continue; fi
  if [[ "$m" == M6 ]]; then
    strata_with_images
    if milestone M6; then image_batch; else log "M6 not passed — no image batch"; fi
  else
    milestone "$m" || true
  fi
done
log "orchestrator done"
