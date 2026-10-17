PHASE 5 — CODE REVIEW. You are a strict principal engineer reviewing a codebase you did not
write. Read docs/REQUIREMENTS.md (all of it, including CODE QUALITY AND STRUCTURE),
docs/ARCHITECTURE.md and docs/PROGRESS.md, then the whole code: src/, scripts/, tests/, configs.
Do not change any code.

Write docs/CODE-REVIEW.md: every problem, ranked blocker / major / minor, each with file:line,
the reason and a concrete fix. Cover at least:
- requirements coverage: go through every STOREFRONT and ADMIN bullet of REQUIREMENTS and say
  where it is implemented, or that it is missing or partial;
- correctness: stock, transactions, the order state machine, pricing/VAT, label creation;
- security: admin auth and session, CSRF/origin checks, route handlers, input validation,
  files served from public/;
- clean code: dead code, unused files, scripts or dependencies, leftovers from earlier
  milestones, duplication, layering (src/lib pure, I/O in src/server), naming, `any`, comments;
- docs that no longer match the code (README, ARCHITECTURE, PLAN).
git add -A && git commit -m "Code review of the whole codebase" && git push. Stop.
