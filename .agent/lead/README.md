# .agent/lead — the lead's tools for this run

The lead (Claude) only delegates and observes; these are the tools it used, kept for transparency.

| File | What it does |
|---|---|
| `review-issues.py` | creates the 35 issues of the lead's code review (#2–#36): problem, where, how to see it, expected — no fix |
| `feature-issues.py` | creates the phase-2 feature issues (#39–#49): the user's wishes and the lead's ideas |
| `check-admin-login.mjs` | logs in to the admin over a given base URL and opens admin pages (reproduced #1) |
| `screenshots.mjs` | screenshots of home, listing, product page and admin for the lead's visual check |
| `handover-run.sh` | the code review session followed by the QA phase through the orchestrator |

Secrets (`.env*.local`) and session logs (`.agent/logs/`) are never committed.
