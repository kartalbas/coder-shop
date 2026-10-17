<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Rules of coder-shop — read before every task

Set by the user and the lead; they override anything else you assume. The details are in
docs/REQUIREMENTS.md.

## How work arrives and leaves
- All work comes as GitHub issues of **this repository only** (kartalbas/coder-shop), through
  `gh`. Never touch another repository, its issues or settings.
- Order: `user-report` first, then severity blocker → major → minor; security first.
- One commit per issue, message contains `fixes #<N>`; push. Partly done → push the part,
  comment what is left, keep it open. Not valid or not fixing → close with a reason.
- Leave the tree clean, everything pushed, and no process running (no dev server, no mongod).

## How to develop: plan → build → review
- **Plan** (high reasoning effort): read the issue with all comments and the code it touches,
  post a comment starting with `Plan:` — root cause or design, files and data, how it stays
  agnostic, the tests that prove it, risks. Large issues in steps.
- **Build** (medium effort): follow the plan; fix root causes; write the tests first or alongside,
  they must fail without the change; `npm run build`, `npm run lint`, `npm test` and
  `npm run test:e2e` green before every push.
- **Review** (high effort, a fresh session): check every point of the issue against the diff;
  reopen with exactly what is missing.

## Non-negotiable rules
- **Agnostic and dynamic:** no hard-coded values, types, attributes, statuses, prices, texts or
  special cases in code; they are data or configuration read by generic code. A new product
  type, attribute, language or payment method needs no code change. No workarounds.
- **English code, German content:** every identifier, file, folder, route segment, public URL,
  API path, key, comment, commit and doc is English. German is only the base language of the
  content; all texts come from the one translation table, read dynamically per request.
- **Clean code:** the structure in docs/REQUIREMENTS.md; small single-purpose modules; no dead
  code, duplicates, `any`, TODOs, debug output or leftovers; docs updated with the code.
- **Security and data:** no secrets or generated files in git; production refuses unsafe
  defaults; personal data only for its owner.
- **Quality of the product:** modern, calm, accessible UI (keyboard, screen reader, no layout
  shift, nothing overlapping), German copy correct, every flow covered by e2e tests.
