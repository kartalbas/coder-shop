PHASE 7 — WORK THROUGH THE ISSUE QUEUE with the GitHub CLI `gh`.

Scope: ONLY this repository, kartalbas/coder-shop (GH_REPO is set to it). Never run gh or git
against any other repository, never change repository settings, labels you did not get, or other
people's comments.

Read docs/REQUIREMENTS.md, docs/ARCHITECTURE.md and docs/PROGRESS.md first. Then:
1. `gh issue list --state open --limit 100` — work in this order: severity:blocker, then
   severity:major, then severity:minor; within a severity, security first.
2. For each issue: `gh issue view <N>`; reproduce it; fix the root cause; add or adjust tests
   that fail without the fix; keep `npm run build`, `npm run lint`, `npm test` and
   `npm run test:e2e` green. One commit per issue whose message contains "fixes #<N>", then
   `git push` (the push closes the issue).
3. If an issue is not valid, or you decide not to fix it, close it with
   `gh issue close <N> --comment "<reason>"`. If you can only fix part of it, push that part,
   comment what is left and keep it open.
4. Update docs/ (ARCHITECTURE, DECISIONS, PROGRESS) when a fix changes them.
Work through as many issues as you can; leave the working tree clean and everything pushed.

GATE REPORT FROM THE LEAD (fix these first if any):
{{GATE}}
