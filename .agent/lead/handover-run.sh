#!/usr/bin/env bash
# The handover: a code review session, then QA (fixes + e2e) through the orchestrator's gates.
cd /home/mkadm/repos/coder-shop || exit 1
systemctl --user stop coder-shop-web
echo "$(date +%T) code review starts" >> .agent/logs/orchestrator.log
env -u LLAMA_API_KEY .agent/prompts/run-phase.sh P5-code-review .agent/prompts/5-code-review.md 25
echo "$(date +%T) code review session ended: $(git log -1 --format=%s)" >> .agent/logs/orchestrator.log
DEADLINE=09:30 MAX_ATTEMPTS=3 SESSION_MIN=40 .agent/orchestrate.sh QA
