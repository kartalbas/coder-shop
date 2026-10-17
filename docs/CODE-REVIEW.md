# coder-shop — Code review (whole codebase)

Strict review of the implementation against `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md` and
`docs/PROGRESS.md`. Read-only: no code was changed. Gates re-run during the review:
`npm run lint` ✅ (0 warnings), `npm test` ✅ 155/155 (17 files). One finding below was
additionally confirmed empirically against a real mongod (B1).

Severity: **BLOCKER** = breaks a hard requirement or corrupts data; **MAJOR** = real defect,
security weakness or requirement-relevant drift; **MINOR** = small risk, cleanliness or docs.

---

## 1. Blockers

### B1. Checkout can oversell and drive stock negative — the stock guard matches the wrong variant

- **Where:** `src/server/checkout.ts:89-97` (`decrementStock`)
- **Reason:** the filter is
  `{ _id, "variants.sku": sku, "variants.stock": { $gte: qty } }`. Without `$elemMatch`, the
  two dotted conditions match **independently across array elements**: the document matches if
  *any* variant has the sku **and** *any* (possibly different) variant has `stock ≥ qty`. The
  `arrayFilters` then decrement the *sku* variant regardless of its own stock. Verified against
  a real mongod: product with variants `A(stock 0)` / `B(stock 10)`, order `A × 5` →
  update matched and `A` ended at **−5**. Every seeded product has multiple variants, so this
  is the normal case, not a corner. The test suite misses it because every checkout test uses
  single-variant products (`tests/create-order.test.ts:13-30`,
  `tests/checkout-transaction.test.ts:6-28`), and `tests/checkout-transaction.test.ts:49,98`
  even duplicates the buggy query verbatim, blessing it.
- **Fix:** express the guard on the *same* element:
  ```ts
  { _id: line.productId, variants: { $elemMatch: { sku: line.sku, stock: { $gte: line.qty } } } }
  ```
  (keep the `arrayFilters` for the positional `$inc`). Fix the duplicated raw query in
  `tests/checkout-transaction.test.ts` the same way, and add a regression test: one product,
  two variants, the ordered variant at 0 and a sibling variant well stocked → order must fail
  and stock must not move.

### B2. Admin product management is entirely missing

- **Where:** no `src/app/admin/(panel)/products/**`, no `src/server/actions/admin/products.ts`
  (both are listed in `docs/ARCHITECTURE.md` §2 as existing); the admin sidebar
  (`src/components/admin/sidebar.tsx:15-21`) has no products entry.
- **Reason:** REQUIREMENTS → ADMIN: "Products: list, search, edit (incl. variants, stock,
  images)". Nothing of it exists — no list, no search, no edit, no stock/variant/image editing,
  and therefore the ARCHITECTURE §3 `filter`-recompute-on-edit rule and the "edit a variant's
  colour → listing facet reflects it" integration test are unimplementable. The gap was
  introduced in planning (no PLAN milestone covers admin products) and never flagged:
  `docs/PROGRESS.md` ends with "Done — M1–M6 complete" without mentioning it.
- **Fix:** implement `/admin/products` (debounced search table, inline stock edit) and
  `/admin/products/[id]` (variant table: price delta, stock, weight, attributes; image strip;
  featured toggle) behind `updateProductCore`/`updateVariantCore`/`toggleFeaturedCore` that
  recompute `filter` via `deriveFilter` on every variant-touching write (ARCHITECTURE §3),
  plus the promised integration test. Until then PROGRESS must not claim completion.

---

## 2. Major

### M1. `transitionOrderCore` is not concurrency-safe — double cancel can double-restock

- **Where:** `src/server/orders-admin.ts:113-131`
- **Reason:** the order is read with `findById(...).session(session)` and written back with
  `updateOne({ _id: order._id }, ...)` — the write is **not conditioned on the status that was
  validated**. Two concurrent cancels (double-click, two admins) can both read `paid`, both run
  `restockLines` in their transactions and both append `cancelled` to the log → stock credited
  twice. `createLabelCore` already does this correctly (`src/server/shipping/label.ts:65-83`,
  conditional `findOneAndUpdate` on `status: "packed"`); the transition path is the weaker twin.
- **Fix:** `OrderModel.updateOne({ _id: order._id, status: from }, { $set: {...} }, { session })`
  and treat `matchedCount === 0` as a conflict (abort + retry or a clean error). Same for the
  restock: it must run only if the conditional status update matched.

### M2. `tests/checkout-transaction.test.ts` tests a copy of the production query, not the code

- **Where:** `tests/checkout-transaction.test.ts:44-58, 93-104`
- **Reason:** ARCHITECTURE §2 promises "All business behavior is tested by calling the core
  functions directly". This file instead re-implements the `findOneAndUpdate` guard inline —
  including the B1 bug — so it passes while the real `createOrderCore` path is broken for
  multi-variant products. It is also near-total duplication of `tests/create-order.test.ts`.
- **Fix:** delete the file (coverage already exists in `tests/create-order.test.ts`) or rewrite
  it to call `createOrderCore` with a multi-variant product (see B1 fix).

### M3. Text index defined but never used; docs claim otherwise

- **Where:** `src/models/product.ts:112`; `src/server/search.ts:249-256`;
  `docs/ARCHITECTURE.md` §3 ("text index covers name/brand") and §4 ("text index covers
  name/brand")
- **Reason:** `searchProducts` uses a regex-escaped literal prefix on `name`/`brand`; the
  compound text index over `name/description/brand` is never queried — pure write-time cost and
  a docs lie. (The regex approach itself is fine at 200 docs and injection-safe.)
- **Fix:** drop the text index (and the DECISIONS/ARCHITECTURE sentences about stemming), or
  switch `searchProducts` to `$text`. Pick one and make code and docs agree.

### M4. Dead code, unused exports, unused files and dependencies (REQUIREMENTS: "no dead code …
unused files, dependencies or exports")

- `src/server/checkout.ts:10` — `ORDER_NUMBER_YEAR` exported, never imported anywhere.
- `src/lib/validations/checkout.ts:36` — `checkoutPayloadError` never used.
- `src/lib/validations/listing.ts:6` — `ProductTypeParam` never used.
- `src/lib/validations/checkout.ts:33` — `CheckoutLine` never used.
- `src/lib/validations/purchasing.ts:24` — `PoLineInput` never used;
  `src/server/purchasing.ts:340` — pointless `export type { CreatePurchaseOrderInput }`
  re-export, no consumer.
- `src/lib/stock.ts:1-7` — `canFulfill`/`applyDelta` are referenced only by their own unit
  tests; production checkout guards stock in the DB and never calls them (ARCHITECTURE §2
  advertises them as the stock rules — they are decorative).
  `src/lib/orders/state-machine.ts:54` — `transitionsWithRestock` likewise test-only
  (`orders-admin.ts:122` re-implements the same predicate inline with `RESTOCK_STATUSES`).
  Either use them at the call sites or delete them with their tests.
- `src/models/product.ts:117` — `export { deriveFilter }` re-export unused (everyone imports
  `@/lib/facets`); it also muddles the model→lib layering.
- Unused vendored UI components (0 importers outside `src/components/ui`):
  `src/components/ui/avatar.tsx`, `tabs.tsx`, `table.tsx`, `drawer.tsx`. `drawer.tsx` is the
  only consumer of the `vaul` dependency (`package.json:28`) → unused dependency. The admin
  tables are hand-rolled `<table>` markup while `ui/table.tsx` sits unused — pick one.
- `vitest.config.ts:2` — `@vitejs/plugin-react` is loaded but no `.tsx` test exists; the
  dependency exists only for hypothetical component tests (ARCHITECTURE §1 "component tests if
  needed" — they were never written).
- Duplication: the mock tracking-number generator exists twice —
  `src/server/shipping/mock.ts:5-15` and `scripts/seed/seed.ts:59-64` (same alphabet, same
  length, copy-paste). Order/PO number minting is duplicated between
  `src/server/checkout.ts:110-117` and `src/server/purchasing.ts:219-226` — extract one
  `mintNumber(counterId, format)` helper.
- **Fix:** delete the dead exports/files/deps, deduplicate the two helpers, or wire the pure
  predicates into the call sites they claim to guard.

### M5. `z.coerce.boolean()` silently turns `"false"` into `true`

- **Where:** `src/lib/validations/purchasing.ts:13`
- **Reason:** `Boolean("false") === true`. Today the only caller (`toSupplierInput`,
  `src/server/purchasing.ts:86-94`) passes a real boolean, so it is latent — but
  `createSupplierCore`/`updateSupplierCore` accept `unknown` and any future caller passing
  form/query strings would silently re-activate deactivated suppliers.
- **Fix:** `z.enum(["true", "on"]).or(z.literal(true)).transform(() => true)` style, or simply
  `z.boolean()` since the only producer already coerces.

### M6. Mega-menu brands drift from the seeded catalog

- **Where:** `src/components/storefront/mega-menu.tsx:11-27`
- **Reason:** brands are hardcoded. "Columbia" (clothing) has **zero** products in the seed
  (`scripts/seed/catalog.ts:82-88` — The North Face, Jack Wolfskin, Mammut, Patagonia, Vaude),
  so the link lands on the empty state; "New Balance" (shoes, `catalog.ts:79`) is missing from
  the menu. A "premium" mega-menu that 404s content is a visible defect.
- **Fix:** render the mega-menu from a server-fetched brand-per-type list (one `distinct`
  aggregate), or at minimum sync the constant with the catalog and add a test asserting every
  menu brand returns ≥ 1 product.

### M7. JSON-LD injected via `dangerouslySetInnerHTML` without escaping

- **Where:** `src/components/storefront/json-ld.tsx:21`
- **Reason:** `JSON.stringify` does not escape `<`, so a product field containing `</script>`
  breaks out of the script tag. Today all input is seeded, but B2 will add admin-editable
  product text — this becomes stored XSS the day product editing lands.
- **Fix:** `JSON.stringify(json).replace(/</g, "\\u003c")` (or render via a small helper that
  does it).

### M8. `docs/ARCHITECTURE.md` no longer matches the code (multiple sections)

- **Where / what:**
  - §2 file tree lists files that do not exist: `actions/admin/products.ts`,
    `admin/products/page.tsx`, `admin/products/[id]/page.tsx`, `variant-picker.tsx`,
    `product-form.tsx`, `variant-editor.tsx`, `po-lines-editor.tsx`,
    `hooks/use-media-query.ts` (only `use-debounce.ts` exists). The variant picker is inlined
    in `product-detail.tsx`, the PO editor is `po-create-form.tsx`.
  - §1 still pins `typescript 7.0.2`; the repo uses `^6.0.3` (the fallback is recorded in
    DECISIONS but ARCHITECTURE was never updated — §1's "Toolchain gate" paragraph still
    asserts 7.0.2).
  - §6 still says tests run with `poolOptions: { threads: { singleThread: true } }`; the actual
    config is `maxWorkers: 1` + `fileParallelism: false` (`vitest.config.ts:16-18`).
  - §8 says dark mode is an "own tiny provider"; the code uses the `next-themes` package
    (`src/app/layout.tsx:3`, `package.json:21`).
  - §3/§4 text-index claims — see M3.
- **Fix:** reconcile ARCHITECTURE with the tree, or mark the tree "aspirational" — a doc that
  lists eight nonexistent files is worse than no doc for the next engineer.

---

## 3. Minor

1. **Actor hardcoded in the order log** — `src/server/actions/admin/orders.ts:39` stamps every
   transition `by: "admin@codershop.ch"` instead of the session user. `requireAdminSession()`
   already returns the userId; resolve the email (or store the id).
2. **Weak path containment for label PDFs** —
   `src/app/admin/labels/[orderId]/route.ts:33`: `file.startsWith(path.resolve(LABELS_DIR))`
   also accepts a sibling `data/labels-evil/...`. Use
   `path.relative(LABELS_DIR, file)` and reject `..`/absolute results, or compare with a
   trailing `path.sep`. (Not exploitable today: `labelPath` is only written by
   `createLabelCore` from a fixed template.)
3. **HTTP status inferred from a German error substring** —
   `src/app/api/shipping/label/[orderId]/route.ts:31` (`error.includes("nicht gefunden")`).
   A reworded message silently changes 404→409. Return a typed `reason` from `createLabelCore`.
4. **Label file written before the conditional move** —
   `src/server/shipping/label.ts:58` writes the PDF, then the `findOneAndUpdate` may lose
   the race and the file is orphaned; two concurrent calls from `packed` also hit the provider
   twice (with real UPS: two shipments billed). Write after the successful move, or dedupe
   in-flight requests per order.
5. **Health endpoint leaks raw error messages** — `src/app/api/health/route.ts:10-11` returns
   `error.message` to unauthenticated callers (connection strings/paths can surface). Return a
   generic message, log the detail server-side.
6. **Session outlives the user** — `src/server/session.ts:96-102` verifies the token only; a
   deleted admin keeps access for up to 12 h. Single-admin demo, acceptable — note it in
   DECISIONS.
7. **Login timing side-channel** — `src/server/session.ts:81-82`: unknown email skips the
   scrypt verify, so response time distinguishes existing accounts. Credentials are public in
   the README, so cosmetic; a dummy-hash verify on miss would close it.
8. **Login throttle Map is unbounded** — `src/server/session.ts:29`: entries are only removed
   on the next hit for the same key; many distinct IPs grow memory forever. Sweep expired
   entries periodically.
9. **`SESSION_SECRET` bypasses the env schema** — read ad hoc in
   `src/server/session-token.ts:8` while every other env var goes through
   `src/server/env.ts:3-12`. Add it there for consistency (and a production warning).
10. **Empty-string env crashes the app at import** — `src/server/env.ts:12` uses
    `.parse(process.env)` with `.min(1).optional()`; `UPS_CLIENT_ID=""` (common in `.env`
    files) fails the schema and takes down every route at module load. Preprocess `"" → undefined`.
11. **German query param violates the language rule** —
    `src/app/admin/(panel)/suppliers/page.tsx:24` uses `?bearbeiten=`; ARCHITECTURE's own rule
    says query params are English (`?edit=`).
12. **Deprecated zod API** — `src/server/actions/admin/auth.ts:13` uses
    `z.string().email()`; zod 4 deprecates it in favour of `z.email()` (used everywhere else).
13. **Silent 200-row caps** — `src/server/orders-admin.ts:34` (`listOrders`) and
    `src/server/purchasing.ts:114` (`listPurchaseOrders`) truncate at 200 with no pagination or
    "more" indicator.
14. **Revenue buckets by `createdAt`, not payment date** —
    `src/server/dashboard.ts:49`: an order created 40 days ago and paid yesterday never counts.
    Recorded in DECISIONS, but the KPI label "Umsatz (30 Tage)" reads like payment date; worth a
    tooltip or `payment.paidAt` bucketing.
15. **Prices/names resolved outside the transaction** —
    `src/server/checkout.ts:174` (`resolveLines` runs before the session starts): a concurrent
    price edit is billed at the stale price. Stock is re-guarded inside; price is not.
16. **Duplicated status enum** — the seven statuses are spelled out in
    `src/lib/orders/state-machine.ts:1-9` *and* `src/models/order.ts:8-16` *and* twice as
    inline `enum:` arrays in `src/models/order.ts:83,155`. Import from the state machine.
17. **`escapeRegex` lives in `src/server/search.ts:245`** but is a generic utility imported by
    `purchasing.ts` — move to `src/lib` (it is pure).
18. **Double zod parse on checkout** — `src/server/actions/checkout.ts:28-35` parses, then
    `createOrderCore` (`src/server/checkout.ts:164`) parses the same payload again. Accept the
    parsed type in the core or drop the action's parse.
19. **Mongoose `collection` reserved-path warning** fires on every test/seed run
    (`docs/PROGRESS.md` M1 "harmless, kept for spec fidelity"). One schema option
    (`suppressReservedKeysWarning`) silences it; leaving known noise in the test output trains
    everyone to ignore warnings.
20. **Stock-level magic number in a component** —
    `src/components/storefront/stock-indicator.tsx:7`: `Math.max(restockThreshold, 5)` — the
    grün/gelb/rot threshold is domain logic living in JSX; move to `src/lib/stock.ts` (where the
    pure predicates that nobody uses, M4, already live).
21. **README gaps** — no mention of `npm run images`, `LLAMA_API_KEY` or `IMAGE_API_URL`
    (M6 pipeline, `src/server/env.ts:8-9`) in the run instructions or the env table; the
    "Seed" section still describes SVGs as the product imagery without noting the photo
    pipeline that replaces them.
22. **`as never` casts in `src/test/smoke.test.ts:67,98`** — type escape hatches for the
    insert payloads; a small `makeOrderFixture()` helper would keep the tests honest.
23. **Mega-menu is mouse-only** — `src/components/storefront/mega-menu.tsx`: opens on
    `onMouseEnter`/click but has no Escape handling or focus management; keyboard users can
    reach the brand links only via the button. (axe scan passed because the panel is
    conditionally rendered, but the pattern is thin.)
24. **`next-env.d.ts` is gitignored** (`.gitignore` "typescript" block) — Next recommends
    committing it; harmless here since lint/build regenerate it, but it is a deviation.
25. **`package.json` mixes exact pins with `^` ranges** (`next-themes`, `radix-ui`, `sonner`,
    `vaul`, `typescript`) against the "exact newest stable pins" rule of ARCHITECTURE §1 —
    and `vaul` is unused anyway (M4).

---

## 4. Requirements coverage

### STOREFRONT (REQUIREMENTS lines 25-36)

| Bullet | Status | Where |
|---|---|---|
| Home: hero, featured collections, category tiles | ✅ | `src/app/(storefront)/page.tsx` (hero, category tiles, featured rail w/ suspense skeleton) |
| Header mega-menu | ⚠️ partial | `src/components/storefront/mega-menu.tsx` — exists (hover/tap, promo tile) but brands hardcoded and drifted (M6), mouse-only (minor 23) |
| Instant search: debounced, keyboard navigable | ✅ | `search-instant.tsx` (200 ms debounce, ⌘K //, arrows+Enter, combobox aria) + `api/search/route.ts` (regex-escaped prefix, ≤8 hits) |
| Cart drawer with item count badge | ✅ | `cart-drawer.tsx`, `cart-button.tsx`, `stores/cart.ts` |
| Listing: faceted filters per product type | ✅ | `filter-sidebar.tsx` + `server/search.ts` `$facet` counts; brand/size/color/storage/material per type |
| Listing: sorting, pagination, skeletons, empty states | ✅ | `sort-select.tsx`, `pagination.tsx` (clamped page, `_id` tiebreaker in `search.ts:85-89`), `skeletons.tsx`, `empty-state.tsx` |
| Product page: gallery 1–5 images, thumbs, swipe, zoom | ✅ | `gallery.tsx` (drag-swipe, zoom dialog, crossfade) |
| Variant picker updates price, stock, image | ✅ | `product-detail.tsx:51-57` (price/stock/image follow the selected variant) |
| Stock indicator | ✅ | `stock-indicator.tsx` (grün/gelb/rot + dot) |
| Related products, breadcrumbs, JSON-LD | ✅ | `related-products.tsx` (same-brand first, `search.ts:211-225`), `breadcrumbs.tsx`, `json-ld.tsx` (escaping caveat M7) |
| Cart persisted | ✅ | `stores/cart.ts` (`localStorage cart:v1`, validated deserialize, hydrate-after-mount) |
| Checkout: address, shipping method, mock payment | ✅ | `checkout-form.tsx` (zod client+server, shipping radios w/ live prices, card stub never sent/persisted — documented) |
| Order confirmation | ✅ | `order/[number]/page.tsx` (timeline, VAT note, tracking once shipped) |
| Responsive, dark mode, accessible, animations, optimistic UI | ✅ | mobile-first grids + filter Sheet (audit recorded in PROGRESS M2), `next-themes` + toggle, focus-visible rings, skip link, `RouteTransition` + `MotionConfig reducedMotion="user"`, optimistic cart |
| SPA feel: client nav, URL state, prefetching, transitions | ✅ | `listing-shell.tsx` (URL-as-state `router.replace` + parallel `/api/products` fetch), `next/link` prefetch, rewrites for German URLs (`next.config.ts`) |

### ADMIN (REQUIREMENTS lines 38-52)

| Bullet | Status | Where |
|---|---|---|
| Login with seeded admin, credentials in README | ✅ | `session.ts`/`session-token.ts`/`password.ts`, `proxy.ts` (real 307 guard), README line 49 |
| Dashboard: revenue, open orders, low-stock | ✅ | `dashboard.ts` + `(panel)/page.tsx` (30-day revenue over `paid…delivered`, SVG sparkline, low-stock via `isLowStock`, recent orders) |
| **Products: list, search, edit (variants, stock, images)** | ❌ **missing** | **B2** — nothing exists |
| Purchasing: suppliers | ✅ | `purchasing.ts` + `/admin/suppliers` (create/edit/deactivate; no delete — recorded in DECISIONS) |
| Purchasing: POs draft→ordered→received; receipt increases stock | ✅ | `createPurchaseOrderCore`/`markPurchaseOrderOrderedCore`/`receivePurchaseOrderCore` (transactional, `qty − received`, tested in `tests/purchasing.test.ts`) |
| Order intake: list with status filter | ✅ | `(panel)/orders/page.tsx` (tabs + counts) |
| Status workflow validated + logged with timestamps | ⚠️ mostly | state machine `src/lib/orders/state-machine.ts` (exact graph incl. cancel set), `statusLog` per transition; **but** the write is not concurrency-safe (M1) |
| Packing: pick list, printable slip, parcel weight | ✅ | `packing/page.tsx`, `packing/[id]/page.tsx`, `pack-list.tsx`, `@media print` in `globals.css:137+`, weight = Σ qty×g + 150 (`lib/shipping/weight.ts`) |
| Shipping: ShippingProvider interface, UPS behind env vars, mock 1Z + PDF, label → shipped | ✅ | `lib/shipping/types.ts`, `server/shipping/{provider,ups,mock}.ts`, `createLabelCore` (packed-only, idempotent, provider-before-move, PDF in `data/labels/` outside web root) |

### DATA / IMAGES / QUALITY (lines 54-69)

- 200 products 70/70/60, deterministic (mulberry32), variants/stock/weights, 1–5 images: ✅
  `scripts/seed/catalog.ts`; idempotent seed with lock-refusing `--fresh`: ✅ `seed.ts:249-254`.
- Image pipeline per spec (endpoint, size, seed, Bearer key, WebP under `public/products/`,
  paths recorded, no brands/logos, gitignored, placeholder until generated): ✅
  `scripts/images/*`, `product-image.tsx` + `lib/images.ts`; generated files not committed
  (verified: `git ls-files public/products` = `.gitkeep` only).
- Domain logic in `src/lib` + Vitest unit tests; build/lint/test green: ✅ (re-verified;
  `src/lib` is genuinely I/O-free — no mongoose/fs/fetch imports found).
- Milestone commits "M<n>: …", PROGRESS updated: ✅ (but PROGRESS overclaims — see B2).

### CODE QUALITY AND STRUCTURE (lines 71-82)

- Folder structure per spec: ✅ except the missing admin-products slice (B2) and the ARCHITECTURE
  tree drift (M8). `src/lib` pure / I/O in `src/server`: ✅ (one wrinkle: `lib/orders/labels.ts`
  is UI copy in lib — acceptable).
- No `any` anywhere: ✅. No TODO/FIXME/console.log in `src`: ✅.
- Dead code / unused exports / unused files / dependencies: ❌ — M4.
- Duplication: ⚠️ — M2, M4 (tracking generator, number minting), minor 16.
- Generated/runtime files never committed: ✅ (`data/`, `.cache/`, `public/products/*`
  gitignored; `.agent/logs` ignored, lead's `.agent` prompts left untouched).
- Root holds only README + tool config: ✅ (`AGENTS.md` is the Next-generated block file,
  `opencode.json`/`components.json` are tool config).

---

## 5. Security review summary

- **Admin auth/session:** scrypt (N=2^15, r=8, p=1, self-describing hash format) ✅; HMAC-SHA256
  cookie with `exp` inside the signed payload, `timingSafeEqual` with length check, malformed
  tokens rejected ✅; httpOnly + SameSite=Lax + secure-in-prod ✅; 12 h TTL ✅; login throttle
  5/15 min per IP+account ✅ (unbounded map — minor 8; timing oracle — minor 7; fixed dev
  fallback secret is documented and acceptable for a demo with public credentials, but
  `SESSION_SECRET` should at least warn at startup in production).
- **Route guarding:** `src/proxy.ts` (Next 16 proxy, Node runtime — verified against the
  bundled docs) 307s every `/admin/*` without a valid token before rendering; layout
  `requireAdminSession()` as defense in depth ✅. Label GET re-checks the session ✅.
- **CSRF/origin:** the only custom state-changing route (`POST /api/shipping/label/[orderId]`)
  enforces same-origin (missing origin rejected) *and* session ✅. Server Actions rely on Next's
  built-in origin check ✅. GET label route is read-only with `no-store` ✅.
- **Input validation:** zod at every boundary (checkout, listing params, search, login,
  supplier/PO) ✅; regex inputs escaped (`escapeRegex`) ✅; ObjectId validation before queries ✅;
  SKU search bounded ✅. Gaps: M5 (`coerce.boolean`), minor 10 (empty-string env).
- **Files served from `public/`:** only product photos/SVGs (generated content, no PII);
  label PDFs deliberately live in `data/labels/` behind the session guard ✅ (containment check
  is weak — minor 2). No user content is ever written to `public/`.
- **Injection:** no `eval`, no raw regex from users, Mongoose queries built from validated
  shapes; JSON-LD escaping is the one hole (M7).

## 6. Correctness review summary

- **Pricing/VAT:** `vatFromGross` implements the documented rule exactly; totals computed
  server-side from DB prices (client payload carries only sku+qty) ✅; free-shipping/express
  constants match DECISIONS ✅.
- **Stock:** decrement-at-create with transaction + restock-on-cancel from `new/paid/picking`
  matches DECISIONS — but the guard is broken for multi-variant products (**B1**).
- **State machine:** adjacency map matches ARCHITECTURE §5 exactly; same-state rejected;
  label is the only edge into `shipped` ✅; concurrency hole in the persistence layer (M1).
- **Transactions:** checkout, cancel-restock and goods receipt each run in one transaction with
  abort-on-any-failure ✅; transient write-conflict retry (≤3) in checkout ✅; PO receipt is
  idempotent per line (`qty − received`) ✅.
- **Order/PO numbers:** atomic counter inside the transaction, gap-free, `B-/E-YYYY-######` ✅.
- **Label creation:** packed-only, idempotent, provider-before-move, conditional final update,
  PII outside web root ✅ (orphans/double-provider on races — minor 4).

## 7. Verdict

The engineering core is genuinely good: clean layering, honest tests around the core functions,
real transactions, a correctly implemented state machine and a well-documented security model.
But it is not shippable as-is: **B1** corrupts stock on the main commerce path (and the suite
structurally cannot see it), and **B2** leaves an explicit ADMIN requirement unimplemented while
PROGRESS claims completion. Fix B1–B2, then M1–M8; the minors are a cleanup sweep.
