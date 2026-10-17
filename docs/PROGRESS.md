# coder-shop — Progress

## M1 — Scaffold, database, seed ✅ (2026-10-17)

Done
- Scaffold on the ARCHITECTURE §1 pins (Next 16.4.2, React 19.3.1, Tailwind v4, mongoose
  9.11.2, MMS 11.3.0, vitest 5.0.5, ESLint 10 flat config, tsx, zod 4); TypeScript fell back
  to 6.0.3 per the toolchain gate (no stable 7.x — see DECISIONS).
- shadcn init + all 18 listed UI components vendored in `src/components/ui`.
- `src/server/env.ts` (zod, `MONGODB_URI`/`UPS_*` optional), `src/server/db.ts`
  (external URI or single-node `MongoMemoryReplSet` on `data/mongo`, promise cached on
  `globalThis`, async SIGINT/SIGTERM shutdown, lock retry ×3 with recovery message,
  `syncIndexes` once per process); `GET /api/health`.
- MMS binary pinned (`8.2.6`, `downloadDir: ".cache/mongod"`) and downloaded once.
- All six Mongoose models with the §3 indexes.
- Vitest `globalSetup` throw-away in-RAM replica set + cleanup helpers; single worker via
  `maxWorkers: 1` (Vitest 5 replaced `poolOptions` — DECISIONS); smoke test round-trips a
  Product and a transaction (commit + abort).
- `scripts/seed/` (catalog/svg/seed): deterministic 200 products (70/70/60), 1–5 generated
  SVGs per product into `public/products/`, admin user, 3 suppliers, sample POs, 15
  clock-relative orders; idempotent; `--fresh` refuses while the dbPath lock is held.
- Pure libs + unit tests: pricing (VAT rule), format (de-CH CHF), order state machine (full
  graph), stock predicates, `deriveFilter`, parcel weight (`PACKAGING_GRAMS = 150`).
- README (run/seed/test, admin credentials, lock recovery, `MONGOMS_SYSTEM_BINARY`),
  `docs/DECISIONS.md`, this file, `.gitignore` (`data/`, `public/products/*` + `.gitkeep`,
  `.cache/`).

Verified (acceptance)
- `npm run build` ✅ with no mongod running and no env set; `npm run lint` ✅.
- `npm test` ✅ 76 tests / 8 files (≥ 30 unit tests incl. VAT rounding, every state-machine
  edge, stock predicates, format, `deriveFilter`, parcel weight).
- `npm run seed` exits 0; a third consecutive run produced byte-identical counts and order
  numbers (`B-2026-000001…000015`); per product `1 ≤ images.length ≤ 5` and every
  `images[].src` exists on disk; 70/70/60 by type; skus unique; stock ≥ 0;
  `weightGrams > 0`.
- Integration test: over-sell checkout transaction aborts, nothing written; sufficient-stock
  transaction commits and decrements.
- Background `npm run start` + `curl localhost:3000/api/health` → `{"ok":true,"db":"memory-server"}`;
  stopped again.

Open / known issues
- Storefront/admin pages are M2–M5 scope; `/` is the scaffold placeholder.
- Mongoose warns that `collection` is a reserved schema pathname (optional `collection`
  field on Product per ARCHITECTURE §3) — harmless, kept for spec fidelity.

## Next

M2 — Storefront (layout, search, listing, product page, cart store).
