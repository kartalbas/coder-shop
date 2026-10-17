PHASE 7a — PLAN THE NEXT ISSUES (you plan, you do not change code). Scope: ONLY kartalbas/coder-shop.
Read docs/REQUIREMENTS.md, docs/ARCHITECTURE.md and docs/PROGRESS.md. `gh issue list --state open --limit 100`.
Order: user-report first, then severity:blocker, severity:major, severity:minor; security first.
Pick the issues the next build session (about 40 minutes) can finish. For each, read it with all
comments (`gh issue view <N> --comments`), study the code it touches, and post a plan as an issue
comment starting with "Plan:" — root cause or design, the files and data changes, how it stays
agnostic and dynamic (no hard-coded values), the tests that will prove it, risks. Large issues:
split the plan into steps and say which step comes first. Do not edit files, do not commit. Stop.
