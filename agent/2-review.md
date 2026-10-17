PHASE 2 — CRITICAL REVIEW. You are a strict principal engineer reviewing someone else's plan.
Read REQUIREMENTS.md, ARCHITECTURE.md and PLAN.md. Do not change them.

Write REVIEW.md: every problem you find, ranked (blocker / major / minor), each with the
reason and a concrete fix. Look especially for: requirements that the plan misses or covers
vaguely; acceptance criteria that cannot be checked; wrong or outdated versions; risks with
mongodb-memory-server under Next.js (build time, dev hot reload, serverless/edge runtime,
connection reuse); server/client component boundaries; seed and SVG generation for 200
products; order state machine gaps; UPS integration details (OAuth token caching, label
format); performance (indexes, pagination); security of /admin (auth, CSRF, password hashing);
anything that makes the milestones not fit together.
git add -A && git commit -m "Review of the plan". Stop.
