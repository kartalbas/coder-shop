# coder-shop — Decisions

Recorded per REQUIREMENTS ("choose the professional default and record the decision").

## Toolchain (M1)

- **TypeScript 6.0.3 instead of the 7.0.2 pin** (toolchain gate, ARCHITECTURE §1): the
  scaffold builds and lints green with `typescript@^6.0.3` + Next 16.4.2; 7.0.2 is not
  resolvable as a stable release here. All other pins are exactly as specified.
- **Vitest 5 pool config:** `test.poolOptions` was removed in Vitest 4/5. The single-worker
  requirement (shared throw-away replica set must never be wiped while another file reads)
  is expressed as top-level `maxWorkers: 1` + `fileParallelism: false` in `vitest.config.ts`.
- **mongodb-memory-server binary:** pinned to mongod `8.2.6` (verified working against the
  MMS 11 support matrix on this machine) with `downloadDir: ".cache/mongod"` in
  `package.json`; downloaded once during M1, later runs are offline. Distro check:
  Ubuntu 26.04 — auto-detection works; `MONGOMS_SYSTEM_BINARY` documented in the README as
  the fallback for distros where it fails.
- **shadcn `cn` helper:** components import `cn` from `@/lib/utils` (clsx + tailwind-merge),
  the canonical shadcn layout.

## Domain (carried from the review, ARCHITECTURE §10)

- Money as integer cents, gross prices (VAT 8.1 % included); VAT rule
  `vatCents = grossCents − round(grossCents × 100 / 108.1)`.
- Denormalized `filter` block recomputed via pure `deriveFilter` in every operation that
  touches variants (never via document middleware).
- Custom cart store (`useSyncExternalStore`, `localStorage` `cart:v1`) — no zustand.
- Own session/crypto (scrypt N=2^15/r=8/p=1, 12 h HMAC cookie, Origin checks, login
  throttle) instead of next-auth.
- Listing JSON API + URL-as-state; mock payment auto-pays.
- Stock model: decrement at `createOrder`, restock on cancel from `new`/`paid`/`picking`,
  no reservations — real transactions on a single-node replica set.
- Shipping: standard CHF 4.90, express CHF 12.90, free from CHF 100;
  `PACKAGING_GRAMS = 150`.
- Labels under `data/labels/` (outside the web root — PII).
- Deployment target: long-running Node server, all routes `runtime = 'nodejs'`, production
  requires `MONGODB_URI`.
- English code / German public URLs via `next.config.ts` rewrites; no German stemming in the
  text index.
