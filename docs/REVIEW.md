# coder-shop — Review of REQUIREMENTS / ARCHITECTURE / PLAN

Strict review of the Phase-1 documents. Versions in ARCHITECTURE §1 were re-verified with
`npm view <pkg> version` on 2026-10-17: **all 24 pins are correct and current** (next 16.4.2,
react 19.3.1, typescript 7.0.2, tailwindcss 4.3.3, mongoose 9.11.2, mongodb-memory-server
11.3.0, vitest 5.0.5, eslint 10.13.0, zod 4.6.7, motion 14.3.0, pdf-lib 1.17.1, …). Node 24 is
installed as required. The findings below are what still has to be fixed before M1 starts.

Severity: **BLOCKER** = breaks a hard requirement or makes an acceptance criterion impossible
to execute; **MAJOR** = will cause real defects, rework, or a security hole if built as written;
**MINOR** = ambiguity, consistency, or small risk.

---

## Blockers

### B1. Several acceptance criteria cannot be checked as written (Server Actions are not curl-able)

- **Where:** PLAN M3 ("`curl -s -X POST localhost:3000/checkout` … with a valid payload"),
  M4 ("`curl -s localhost:3000/admin` … with seeded login cookie → 200", "Login as seeded
  admin, transition an order … via UI action").
- **Reason:** Checkout and login are **Server Actions**, not plain POST endpoints. A Server
  Action POST requires Next's `Next-Action` header with a build-generated action ID; a raw
  `curl -X POST /checkout` hits the page route and gets 405/400, and you cannot obtain the
  signed session cookie via curl without reimplementing the HMAC signing. "Via UI action"
  implies a browser; the run is explicitly forbidden from anything but background `curl`.
  These criteria are unverifiable, so the milestone gates are not gates.
- **Fix:** Restructure each action as a thin wrapper over a pure server function in
  `src/server/` (e.g. `createOrderCore`, `transitionOrderCore`, `loginCore`). Acceptance
  criteria then run those functions in Vitest integration tests (real mongod from globalSetup)
  and assert DB effects. Keep `curl` only for GET pages and for `POST /api/shipping/label/…`
  (a real route handler). For the admin-redirect check, curl without cookie is fine; the
  "with cookie → 200" case becomes an integration test that calls `loginCore` and passes the
  returned cookie to `fetch`. Delete the "via UI action" wording.

### B2. Admin security is under-specified: no CSRF/Origin protection, no session expiry, no hashing parameters

- **Where:** ARCHITECTURE §1 ("HMAC-signed cookie, httpOnly, SameSite=Lax"), §4
  (`POST /api/shipping/label/[orderId]`), `admin/auth.ts`; PLAN M4 task 1.
- **Reason:** (a) The label route handler is cookie-authenticated state-changing POST.
  SameSite=Lax blocks cross-site *top-level* POSTs but is not a CSRF defense for
  fetch-based requests in all edge cases, and nothing in the plan validates `Origin`.
  (b) The session cookie has no expiry claim and no rotation — a leaked HMAC cookie is a
  permanent admin key. (c) "scrypt, salt embedded" names no parameters (N/r/p, keylen,
  maxmem) — a weak choice here is silent and unrecoverable after seed. (d) No login rate
  limiting/lockout, while the credentials are printed in the README.
- **Fix:** Decide and record in DECISIONS.md: (1) every state-changing route handler and
  server action validates the request `Origin` against the host (Next does this for actions
  in App Router, but the custom route handler must do it explicitly); (2) session cookie
  payload = `{ userId, exp }`, signature covers `exp`, e.g. 12 h, verified with
  `timingSafeEqual`; (3) scrypt with explicit params (N=2^15, r=8, p=1, 16-byte salt,
  32-byte key, stored as `scrypt$N$r$p$salt$hash`); (4) per-IP/per-account failed-attempt
  throttle (in-memory counter is acceptable for this single-process app). Add an M4 test:
  label route rejects a forged `Origin`.

### B3. Shipping labels written to `public/labels/` are publicly readable PII

- **Where:** ARCHITECTURE §4 (`createLabel` … "stores … label file under `public/labels/`"),
  PLAN M4 task 4.
- **Reason:** Everything under `public/` is served statically with **no auth**. An UPS/mock
  label PDF contains the customer's full name and street address — a direct PII leak to
  anyone who guesses or scrapes the path, contradicting "production-grade".
- **Fix:** Write labels to `data/labels/` (gitignored, outside the web root) and serve them
  through an authenticated admin route `GET /admin/labels/[orderId]` (or
  `GET /api/label/[orderId]` behind the session guard) with `Content-Type: application/pdf`.
  Update the M4 acceptance check ("PDF starting `%PDF-`") to fetch through that route or
  read the file path from the order doc.

### B4. mongod lifecycle is unsafe: async stop on `exit` never runs, orphaned lock blocks restarts, dev + seed collide on one dbPath

- **Where:** ARCHITECTURE §6 ("`process.on('exit')` stops it", persistent `data/mongo`),
  PLAN M1 task 3.
- **Reason:** (a) `process.on('exit')` handlers run **synchronously only** —
  `MongoMemoryServer.stop()` is async, so it never completes; the mongod child is orphaned
  or leaves `data/mongo` with a live WiredTiger lock file. The next `npm run dev` /
  `npm run seed` then fails with "Unable to lock file" — exactly the "just works, no
  installed DB" promise broken, and the background-start/stop cycle the run uses every
  milestone makes this a daily failure. (b) Running `npm run seed` while `npm run dev` is
  up starts a **second mongod on the same dbPath** → lock conflict or corruption.
  (c) `dbPath` must exist before `MongoMemoryServer.create()` — not mentioned.
- **Fix:** In `db.ts`: handle `SIGINT`/`SIGTERM` with an async handler that awaits
  `stop()` then `process.exit()`; on startup, if the lock error occurs, retry a few times
  and surface a clear message ("stop the dev server or delete data/mongo/mongod.lock");
  `mkdir -p data/mongo` before create. `seed --fresh` must refuse (or detect-and-warn) when
  another process holds the lock. Record the recovery procedure in README.

---

## Major

### MA1. Vitest: one shared mongod + per-file `afterEach` collection cleanup = flaky suite

- **Where:** ARCHITECTURE §6 tests ("globalSetup starts a throw-away MongoMemoryServer …
  each test file cleans its collections in `afterEach`").
- **Reason:** Vitest 5 runs test files in parallel workers by default. File A wiping
  `products` while file B is mid-query produces intermittent failures — and "npm test green"
  is a hard per-milestone gate, so flakiness is fatal.
- **Fix:** Either `poolOptions: { threads: { singleThread: true } }` (cheap at this scale),
  or give each test file its own database name (`db_<file>`) on the shared mongod. State
  the choice in the architecture.

### MA2. UPS integration details missing: OAuth token caching, API version, and the real provider is never tested

- **Where:** ARCHITECTURE §1/§4, PLAN M4 task 4 ("OAuth client-credentials + Shipping API via fetch").
- **Reason:** (a) UPS OAuth tokens last ~3 h; requesting a token on **every** label call
  hits UPS auth rate limits and adds latency — the plan never says to cache the token.
  (b) No endpoint/version is pinned (token endpoint, Shipping API resource + version, test
  vs production host) — that invites exactly the "guess a version" the requirements forbid.
  (c) M4 tests cover only the factory and the mock; `UpsShippingProvider` itself (request
  shape, base64 PDF decoding of `labelImageFormat=PDF` response, error mapping) ships
  untested.
- **Fix:** Specify: token cached in-process until `expiresIn − 60 s`, single-flight refresh,
  Basic auth header per UPS OAuth spec; pin the Shipping API resource/version after looking
  it up (record in DECISIONS.md); label response handled as base64 PDF → written to disk.
  Add unit tests for `UpsShippingProvider` with `fetch` mocked (token caching, success,
  HTTP error → typed failure). Define behavior when label creation fails: order must **not**
  move to `shipped` (plan says "provider must succeed first" — make it an explicit test).

### MA3. `filter` facet block goes stale after admin edits (Mongoose hooks don't run on `findOneAndUpdate`)

- **Where:** ARCHITECTURE §3 ("filter … derived from variants on save"), §4
  (`updateVariant` action), PLAN M4/M5 product editing.
- **Reason:** The natural implementation of `updateVariant` is
  `Product.updateOne/findOneAndUpdate` on a variant path — which skips `save()` hooks and
  validators. The denormalized `filter.farben/groessen/…` then no longer matches variants:
  facets show wrong values and filtered listings silently miss products.
- **Fix:** Recompute `filter` inside the action itself (pure `deriveFilter(variants)` in
  `lib/`, unit-tested) and include it in every update that touches variants. Never rely on
  document middleware for it. Add a test: edit a variant's colour → listing facet reflects it.

### MA4. Stock model is contradictory: "reservation" (requirement) vs decrement-with-compensation (architecture), and `lib/stock.ts` purity

- **Where:** REQUIREMENTS QUALITY ("stock reservation" in `src/lib`), ARCHITECTURE §4
  ("transaction-less multi-doc guard; on partial failure compensate"), §2
  (`lib/stock.ts` "pure domain logic, no I/O" per folder rules).
- **Reason:** Reservation semantics (hold at cart/checkout, release on cancel) and
  decrement-at-order are different models; the docs use both words. Also a pure `lib/stock.ts`
  cannot do reservation (it's I/O), so where does the DB half live? And compensation is not
  crash-safe: a process crash mid-loop loses stock with no recovery path — acceptable, but
  only if declared.
- **Fix:** Decide explicitly (recommend: decrement at `createOrder`, restock on cancel — no
  reservations), write it in DECISIONS.md together with the crash-window risk; keep
  `lib/stock.ts` pure (canReserve/applyDelta/lowStock predicates) and put the atomic
  `findOneAndUpdate({ 'variants.$[v].stock': { $gte: n } })` loop in `src/server/`. Note
  that standalone mongod (memory server) cannot use transactions (no replica set) — say so,
  so nobody "fixes" it with `startSession`.

### MA5. State machine gaps: cancel from `neu` doesn't restock; label creation doesn't state its precondition; double-click on "label" is a rejected transition

- **Where:** ARCHITECTURE §5 ("Cancelling from `bezahlt`/`picking` restocks"; "Label creation
  is the canonical path into `shipped`").
- **Reason:** Stock is decremented at `createOrder` while status is `neu`, so **cancelling
  `neu` must restock too** — the doc omits it. `createLabel` doesn't say which source states
  are legal (from `bezahlt` it would skip picking/packed; from `shipped` it double-bills UPS).
  And "same-state transition rejected" means an accidental double-click on the label button
  throws `IllegalTransitionError` instead of being a no-op.
- **Fix:** Restock on cancel from `neu`, `bezahlt`, `picking`. `createLabel` legal only from
  `packed` (enforced in the action, tested). Make `createLabel` idempotent: if order already
  `shipped` with a tracking number, return the existing one.

### MA6. `tsx` is used but not in the dependency table; `@types/node` 26 mismatches the Node 24 runtime

- **Where:** ARCHITECTURE §6 (`npm run seed` → `tsx src/lib/seed/seed.ts`) vs §1 (no `tsx`);
  §1 dev types `@types/node` 26.6.5 vs REQUIREMENTS "Node.js 24 is installed".
- **Reason:** M1 says "add all deps at the exact versions from §1" — `tsx` would be missed.
  `@types/node` 26 types APIs that don't exist on the installed Node 24 runtime; strict TS
  would let code compile that fails at runtime.
- **Fix:** Add `tsx` (latest, verified) to §1 dev deps. Pin `@types/node` to the latest 24.x
  (`npm view @types/node@24 version`), not `latest`.

### MA7. mongodb-memory-server binary download is an undeclared external dependency

- **Where:** ARCHITECTURE §1/§6; REQUIREMENTS "the app needs no installed database".
- **Reason:** On first use MMS downloads a ~70–100 MB mongod binary from
  fastdl.mongodb.org. Consequences nobody planned for: first `npm run seed`/test/build-check
  needs network; distro detection fails on rolling-release distros (then nothing works
  without `MONGOMS_SYSTEM_BINARY`); CI/sandbox without internet fails at M1 step 5.
- **Fix:** Pin `MONGOMS_VERSION` (via `.npmrc`/env, value verified against MMS 11 support
  matrix), trigger the download once in M1 and cache it (`MONGOMS_DOWNLOAD_DIR` under
  `.cache/`, gitignored), document `MONGOMS_SYSTEM_BINARY` as the fallback, and record the
  distro check in DECISIONS.md.

### MA8. Mongoose cache stores instances, not promises — HMR race window

- **Where:** ARCHITECTURE §6 ("Cached on `globalThis` (`__mongoServer`, `__mongoose`)").
- **Reason:** Caching the resolved server/connection leaves a window between two HMR-edited
  module instances where both see the cache empty and start **two mongods** (second fails on
  the dbPath lock — see B4). The standard pattern caches the *promise*.
- **Fix:** `globalThis.__mongoPromise ??= startAndConnect()`; await the cached promise
  (single-flight falls out of this for free — §6 point 3 becomes redundant).

### MA9. Deployment target unstated: persistent dbPath + memory-server are incompatible with serverless/edge

- **Where:** ARCHITECTURE §6 (production = `MONGODB_URI`), but nothing says where this runs.
- **Reason:** `data/mongo`, `data/labels`, runtime file writes and a long-lived mongod all
  assume **one persistent Node server** (`next start`). On Vercel-style serverless or any
  `export const runtime = 'edge'` route, mongoose/MMS fail at import time. The plan never
  pins the runtime, so a stray edge flag anywhere breaks prod paths.
- **Fix:** One DECISIONS entry: "deployed as a long-running Node server; all routes
  `runtime = 'nodejs'`; production requires `MONGODB_URI` (memory-server is dev/seed/test
  only)". Optionally add `export const runtime = 'nodejs'` to route handlers as guardrail.

### MA10. Seed determinism vs "revenue last 30 days" contradict each other

- **Where:** ARCHITECTURE §9 (fixed-seed deterministic data, ~15 sample orders) vs PLAN M5
  acceptance ("Dashboard shows Umsatz > 0 given seeded orders", revenue = paid+ orders, 30 d).
- **Reason:** If seeded order dates are fixed constants, the 30-day dashboard window is
  empty the moment the seed is older than a month — M5 acceptance passes only if you run it
  right after seeding, and the dashboard looks broken to any later reader.
- **Fix:** Generate seeded order timestamps **relative to seed time** (e.g. spread over the
  last 14 days) — still deterministic in content/quantities, only the clock anchor moves.
  Define "paid+" precisely: statuses `bezahlt | picking | packed | shipped | delivered`,
  excluding `cancelled`.

### MA11. Seed idempotency is asserted but not designed (counters, sample orders, images)

- **Where:** PLAN M1 acceptance ("second run is idempotent"); ARCHITECTURE §9/§3 (Counter
  `$inc`, ~15 sample orders, sample POs).
- **Reason:** Re-running seed with `$inc` counters mints new order/PO numbers every run
  (duplicates), and "idempotent" is undefined: upsert products by slug? skip if count = 200?
  What happens to the images of removed products?
- **Fix:** Define: seed upserts products by slug, users by email, suppliers by name; sample
  orders/POs are created only when collections are empty (or keyed by deterministic numbers
  derived from the PRNG, upserted); counters are set to max(existing)+n in one step. State
  this in the seed module doc and test "run twice → same counts".

---

## Minor

1. **Pagination stability:** offset pagination sorted by `priceCents`/`createdAt` without an
   `_id` tiebreaker can duplicate/skip items across pages when prices tie. Fix: always append
   `_id: 1` to sort; clamp `seite` to `[1, ceil(total/pageSize)]`.
2. **Search quality/safety:** text index uses the default (english) analyzer — wrong stemming
   for German descriptions; and "regex/text" search with raw user input risks regex
   injection/ReDoS. Fix: escape regex input (`q` → literal prefix match is enough at 200
   docs), keep text index for name/brand; document that German stemming is not used.
3. **VAT rounding rule unspecified:** `mwstCents` must be defined as
   `round(gross − round(gross × 100/108.1))` (or equivalent) with a unit test; otherwise
   pricing tests and the confirmation page can disagree by 1 rp.
4. **Packaging constant undefined:** M4 asserts weight = Σ qty×weight + "packaging constant"
   but no value/tiers exist. Fix: one constant (e.g. 150 g) in `lib/shipping`, unit-tested.
5. **Free-shipping threshold (CHF 100) and shipping prices (4.90/12.90)** appear only in PLAN
   M3, not in REQUIREMENTS or DECISIONS §10. Fix: add to DECISIONS.md when M3 starts.
6. **Status value language is mixed:** orders use German (`neu`, `bezahlt`), POs use English
   (`draft`, `ordered`). Consistent choice + a DECISIONS note avoids half-translated code.
7. **`.gitignore` gaps:** ARCHITECTURE says `public/products/` content is gitignored, but
   `.gitignore` has no entry for it (nor for `public/labels/` as currently planned). Add
   `public/products/*` (keep `.gitkeep`) and ignore the label dir (per B3: `data/labels/`).
8. **Image-count acceptance is weak:** `ls public/products | wc -l ≥ 200` passes even with 1
   image per product; nothing asserts the ≤ 5 bound or that `images[]` length equals files on
   disk. Fix: the seed check should assert, per product, `1 ≤ images.length ≤ 5` and exact
   file existence (already half there — make it the only criterion).
9. **"Drawer contents wired in M3 if needed"** (PLAN M2 task 6) is vague; REQUIREMENTS demand
   a working cart drawer with badge from M2 on. Fix: state explicitly what M2 delivers
   (drawer UI + add-to-cart working) so M2's gate is checkable.
10. **Accessibility/responsive have tasks but no acceptance criteria** (M2 task 7, M5 task 3
    "axe pass"). Fix: add at least one checkable line per milestone, e.g. "axe-core scan of
    home/listing/product in a jsdom/Playwright-free integration test reports 0 critical
    violations" or explicitly defer a11y to manual review in PROGRESS.md.
11. **`/api/products` serialization unspecified:** Mongoose docs → JSON needs a shared
    DTO mapper (ObjectId→string, Date→ISO, `filter` shape) used by both the server page and
    the API, or the client shell will hydrate with a different shape than it fetches. Put it
    in `lib/search.ts` output types.
12. **`env.ts` optionality:** zod schema must mark `MONGODB_URI`, `UPS_*` optional with
    defaults, or `next build` (no env) fails prerendering the login page.
13. **`--fresh` while dev server runs** drops the DB under a live mongod (same lock family as
    B4) — detect and refuse.
14. **Route-transition exit animations with App Router** (ARCHITECTURE §7
    `AnimatePresence` keyed on pathname) are known to clip exit animations because the old
    tree unmounts immediately. Plan an enter-only transition fallback; don't budget time on
    exit animations.
15. **Testing server actions directly** requires mocking `cookies()`/`revalidatePath`.
    B1's core-function split solves this too — mention it so M4's "state machine via action"
    test doesn't stall.
16. **`syncIndexes` on every connect** is fine at 200 docs, but run it once after first
    connect in the process (guard flag), not per `connectDB()` call.

---

## What checks out

- All pinned versions verified correct today (§ top); Node 24 matches REQUIREMENTS.
- Folder structure, cents-integers, document-oriented Product with derived facets, SPA listing
  pattern with URL-as-truth, cart via `useSyncExternalStore`, provider factory with mock
  fallback, deterministic PRNG seed, "no DB at build time" rule — all sound and consistent
  with the requirements.
- Milestone dependency order (data → storefront → checkout → admin/shipping → purchasing/
  dashboard) fits; M1's pure-lib tests give M3–M5 a real foundation.

## Required actions before M1

1. Rewrite M3/M4 acceptance criteria around integration tests on core server functions (B1).
2. Add the security decisions: Origin checks, cookie expiry, scrypt params, login throttle
   (B2); move labels out of `public/` (B3).
3. Specify the mongod lifecycle hardening in `db.ts` (B4, MA8) and the vitest isolation
   mode (MA1).
4. Add UPS token caching + API version lookup + mocked-fetch tests for the real provider
   (MA2).
5. Patch the dependency table (`tsx`, `@types/node@24`) and DECISIONS list (stock model,
   shipping prices, deployment target, seed idempotency) (MA4, MA6, MA9, MA10, MA11).

## Resolution

Every item resolved in the revised `docs/ARCHITECTURE.md` and `docs/PLAN.md` (2026-10-17).

- **B1** — applied. Actions are thin wrappers over `*Core` functions in `src/server`; acceptance
  checks call them in Vitest integration tests; "via UI action" and action-curling removed.
- **B2** — applied. §4 fixes Origin checks on state-changing handlers, 12 h `exp` cookie
  verified with `timingSafeEqual`, scrypt N=2^15/r=8/p=1 stored self-describing, in-memory
  login throttle; forged-Origin test in M4.
- **B3** — applied. Labels written to `data/labels/` (gitignored, outside the web root), served
  only through session-guarded `GET /admin/labels/[orderId]`.
- **B4** — applied. §6: async SIGINT/SIGTERM shutdown, lock-error retry with clear message,
  `mkdir -p` before create, `--fresh` refuses while the lock is held; recovery in README.
- **MA1** — applied. Vitest pool single-threaded against the shared throw-away replica set (§6).
- **MA2** — applied. Token cached until `expiresIn − 60 s` with single-flight refresh; API
  resource/version looked up and pinned in DECISIONS; `UpsShippingProvider` unit-tested with
  mocked `fetch`; provider-failure-keeps-`packed` is an explicit test.
- **MA3** — applied. Pure `deriveFilter` recomputed inside every operation touching variants
  (§3); middleware never relied on; edit-variant→facet integration test.
- **MA4** — applied with a change: decrement at `createOrder`, restock on cancel, no
  reservations, `lib/stock.ts` pure — but instead of documenting "no transactions", dev/test
  run a single-node `MongoMemoryReplSet`, so real transactions replace compensation entirely.
- **MA5** — applied. Cancel restocks from `new`/`paid`/`picking`; `createLabelCore` legal only
  from `packed` and idempotent when already `shipped`.
- **MA6** — applied. `tsx` 4.23.15 added to §1; `@types/node` pinned to 24.19.2.
- **MA7** — applied. MMS binary version pinned via the package.json config block,
  `downloadDir: ".cache/mongod"` (gitignored), one-time download in M1,
  `MONGOMS_SYSTEM_BINARY` documented, distro check recorded in DECISIONS.
- **MA8** — applied. `globalThis.__mongoPromise ??= startAndConnect()` — the promise is cached,
  single-flight falls out for free.
- **MA9** — applied. DECISIONS entry: long-running Node server, all routes
  `runtime = 'nodejs'`, production requires `MONGODB_URI` (§6).
- **MA10** — applied. Seed timestamps clock-relative (spread over the last 14 days, §9);
  revenue defined as `paid | picking | packed | shipped | delivered` within 30 days (§8).
- **MA11** — applied. §9 defines upsert keys (slug/email/name), sample docs only when
  collections are empty, counters set to `max(existing)+n`; "run twice" test.
- **Minor 1** — applied: `_id: 1` tiebreaker on every sort, page clamped to
  `[1, ceil(total/pageSize)]` (§3).
- **Minor 2** — applied: regex-escaped literal-prefix search; no German stemming, recorded in
  DECISIONS (§3/§4).
- **Minor 3** — applied: `vatCents = grossCents − round(grossCents × 100 / 108.1)`,
  unit-tested (§8).
- **Minor 4** — applied: `PACKAGING_GRAMS = 150` in `lib/shipping/weight.ts`, unit-tested (§8).
- **Minor 5** — applied: 4.90 / 12.90, free ≥ CHF 100, in §8 and the DECISIONS list (§10).
- **Minor 6** — applied: one language rule — all identifiers and statuses English; German only
  in UI copy and public URLs via rewrites (header of ARCHITECTURE, §7).
- **Minor 7** — applied: M1 task 8 gitignores `public/products/*` (keeping `.gitkeep`),
  `data/mongo/`, `data/labels/`, `.cache/`.
- **Minor 8** — applied: the sole image criterion is per-product `1 ≤ images.length ≤ 5` plus
  file existence (§9); the bare file count is gone.
- **Minor 9** — applied: M2 task 6 explicitly delivers a working cart drawer (add-to-cart,
  badge, persistence) with an acceptance line; no "if needed".
- **Minor 10** — applied: M2 has a checkable responsive/focus audit recorded in PROGRESS.md;
  M5 has an axe-core scan (0 critical) or a recorded manual review.
- **Minor 11** — applied: shared `toProductDto()` in `src/server/search.ts` feeds both the
  server page and `/api/products` (§4).
- **Minor 12** — applied: `env.ts` marks `MONGODB_URI`/`UPS_*` optional with defaults;
  "build without env" is an acceptance check (§6).
- **Minor 13** — applied: `--fresh` refuses with a clear error while another process holds the
  dbPath lock (§6).
- **Minor 14** — applied: enter-only route transition; exit animations explicitly not
  attempted (§7).
- **Minor 15** — applied: the B1 core-function split means tests never mock
  `cookies()`/`revalidatePath` (§2).
- **Minor 16** — applied: `syncIndexes` guarded to once per process (§6).
