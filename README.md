# coder-shop

Production-grade e-commerce system with a German storefront (CHF, Swiss VAT 8.1 % included in
prices) and a full admin back office: order workflow (`new → paid → picking → packed → shipped
→ delivered`, cancellable), UPS shipping labels (real UPS REST provider or mock), purchasing
with goods receipt, dashboard with revenue and low-stock alerts.

Full-stack TypeScript: Next.js App Router (Server Components + Server Actions), MongoDB via
Mongoose, Tailwind CSS v4 + shadcn/ui, Framer Motion, Zod, Vitest. **No installed database
required** — a single-node MongoDB replica set (mongodb-memory-server) starts on demand and
persists in `data/mongo`; set `MONGODB_URI` to use an external database instead.

## How this repository is built

coder-shop is built by a **local LLM running through OpenCode** in a spec-driven run: the specs
are the source of truth and the agent works through them milestone by milestone.

- `docs/REQUIREMENTS.md` — the spec: stack, features, quality and delivery rules
- `docs/ARCHITECTURE.md` — stack pins, models, server design, security, UX per page
- `docs/PLAN.md` — milestones M1–M5, each with checkable acceptance gates
- `docs/REVIEW.md` — strict review of the specs, with a resolution per item
- `docs/DECISIONS.md`, `docs/PROGRESS.md` — decision log and milestone status (created with M1)
- `.agent/` — the run's prompts and logs (run bookkeeping, not app code)

## Getting started

```bash
npm install
npm run seed    # deterministic 200 products + generated SVG images + demo data (scripts/seed)
npm run dev     # http://localhost:3000 — storefront at /produkte
```

The first seed/test run downloads a mongod binary into `.cache/mongod` (one-time network need).
If auto-detection fails on your distro, set `MONGOMS_SYSTEM_BINARY` to a local mongod. If the
dev server was killed hard, `data/mongo` may hold a lock — stop all instances or delete
`data/mongo/mongod.lock`.

## Test, lint, build

```bash
npm test        # Vitest: pure-lib unit tests + integration tests on a throw-away replica set
npm run lint
npm run build   # passes with no mongod running and no env set
```

## Admin login

`/admin` — seeded credentials `admin@codershop.ch` / `Admin!2026` (demo only; login lands with
milestone M1 and is completed there).

## Status

Milestones M1–M5 per `docs/PLAN.md`; current state in `docs/PROGRESS.md`. Production
deployment targets a long-running Node server (`next start`) with `MONGODB_URI` set; real UPS
labels activate when `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET` and `UPS_ACCOUNT` are set.
