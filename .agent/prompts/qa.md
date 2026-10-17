PHASE 6 — QA AND HANDOVER. Read docs/CODE-REVIEW.md, docs/REQUIREMENTS.md, docs/ARCHITECTURE.md
and docs/PROGRESS.md first.
1. Fix every blocker and major of docs/CODE-REVIEW.md, and the minors that are cheap; mark each
   item fixed or deliberately not fixed (with the reason) in a "Resolution" section there.
2. Add end-to-end tests with Playwright (newest stable; Chromium only) under tests/e2e/,
   run by `npm run test:e2e` against a production build on its own port with a freshly seeded
   database, covering: browse → filter → product page (gallery, variant) → add to cart → cart →
   checkout → confirmation with order number; admin login → order to picking → packed → UPS
   label (mock) → shipped with tracking number; purchase order received → stock increased.
3. Docs match the code: README, ARCHITECTURE, PROGRESS.
4. `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e` pass. Commit
   "QA: <summary>" and `git push`. Stop.

GATE REPORT FROM THE LEAD (fix these first if any):
{{GATE}}
