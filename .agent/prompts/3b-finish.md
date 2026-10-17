FINISH PHASE 3. docs/ARCHITECTURE.md is already revised (uncommitted) — keep it. Now:
1. Update docs/PLAN.md to match it exactly: src/server vs src/lib, scripts/ for seed and images,
   English identifiers and statuses, MongoMemoryReplSet with transactions, labels under data/,
   docs/ paths, the review's fixes (e.g. acceptance checks that call server functions instead of
   curling Server Actions). Keep it short and checkable.
2. Append "## Resolution" to docs/REVIEW.md: one line per item — applied or rejected, and why.
3. Write README.md: what coder-shop is; that it is built by a local LLM through OpenCode in a
   spec-driven run (docs/: requirements, architecture, plan, review; .agent/: the run's prompts);
   how to start, seed, test, and the admin login (to be completed with M1).
4. git add -A && git commit -m "Plan revised after review; README" && git push -u origin main.
   Stop.
