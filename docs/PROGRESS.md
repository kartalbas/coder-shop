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

## M2 — Storefront ✅ (2026-10-17)

Done
- Global layout: Geist fonts, `next-themes` class dark mode + header toggle, sticky header
  with mega-menu (desktop hover / mobile strip), footer, enter-only `RouteTransition`
  (motion, `MotionConfig reducedMotion="user"` app-wide), sonner toasts; German-URL
  `rewrites` in `next.config.ts` (`/produkte`, `/produkt/:slug`, `/warenkorb`, `/kasse`,
  `/bestellung/:number`).
- Instant search: `/api/search` (regex-escaped literal prefix at word boundaries, ≤ 8 hits)
  + `search-instant.tsx` (200 ms debounce, ⌘K // focus, arrow-key + Enter nav, combobox
  aria pattern).
- Listing `/produkte`: server first paint + client `ListingShell` (URL-as-state via
  `router.replace`, parallel `/api/products` fetch, crossfade, skeletons, empty state);
  facet sidebar with `$facet` counts (brand/size/color/storage/material), mobile filter
  sheet, sort (`price-asc | price-desc | newest`, each with `_id` tiebreaker), numbered
  pagination with clamped page; shared `toProductDto()` feeds server page and API alike.
- Product page: gallery (thumbs, drag-swipe, zoom dialog, crossfade), variant picker
  updating price/stock/image, stock indicator (grün/gelb/rot), qty stepper + add-to-cart
  (opens drawer), related products (same brand first), breadcrumbs, JSON-LD `Product`
  with per-variant offers, description/details accordion.
- Home: hero, category tiles, featured rail (server-fetched, suspense skeleton).
- Cart: `src/stores/cart.ts` external store persisted to `localStorage` (`cart:v1`,
  validated deserialize), badge + drawer update optimistically from any page, survive
  reload; hydrate-after-mount (no SSR mismatch).
- Motion polish + `prefers-reduced-motion` via `MotionConfig reducedMotion="user"`.
- Fixes this session: `RouteTransition` re-key broke PPR resume (dynamic holes never
  streamed — now animates via `useAnimationControls`, see DECISIONS); search prefix now
  matches at word boundaries; seed weights Apple phones to > 24 so the pagination
  acceptance is real; `<img>` lint rule scoped off for storefront SVG images.

Verified (acceptance)
- `curl "localhost:3000/produkte?type=shoes&size=42"` → 200 with 24 `/produkt/…` links in
  the server HTML; `/api/products?type=shoes&size=42`: every item `type=shoes` and
  `"42" ∈ filter.sizes`.
- `/api/products?type=smartphone&brand=Apple&sort=price-asc` → 26 Apple phones only,
  ascending `priceCents`; `page=2` returns the next page (2 remaining items, page 2).
- `/api/search?q=iphone` → 8 JSON hits ("Apple iPhone 16 …").
- Product page HTML contains `"@type":"Product"` JSON-LD and 5 gallery `<img>` sources.
- Home, listing, product pages → 200 with German copy and `CHF` prices.
- Cart store unit tests: serialize/deserialize round-trip, corrupt-payload rejection,
  subscriber notification (badge/drawer), merge/clamp, persistence across "reload".
- Responsive audit (code-level, recorded per plan): product grid `grid-cols-2 sm:grid-cols-3
  lg:grid-cols-4` → 2 cols @375, 3 @768, 4 @1440; facet sidebar `hidden lg:block` replaced
  by a filter `Sheet` below `lg`; mega-menu `md:` and up with a scrollable category strip
  below; product detail single column below `lg`, two columns above; header wraps search
  `max-w-xs sm:max-w-sm`. Visible focus: shadcn `focus-visible` rings on all UI primitives,
  explicit `focus-visible:outline-2 focus-visible:outline-ring` on custom chips, thumbs,
  tiles and links; no `outline-none` anywhere in `src/components/storefront`.
- `npm run build` ✅ with no mongod running and no env set; `npm run lint` ✅ (0 warnings);
  `npm test` ✅ 90 tests / 10 files. Background `npm run start` + curl battery above;
  server and mongod stopped again afterwards.

Open / known issues
- The earlier "GET /produkte → 404" gate finding was a stale `next start` process from a
  pre-M2 build holding port 3000; killed. Orphaned mongod processes after `kill` of
  `next-server` can keep the `data/mongo` lock — README recovery procedure applies.
- Re-seeded with `--fresh` after the seed brand-weight change (old SKUs would collide on
  the unique `variants.sku` index otherwise).
- Cart page `/warenkorb`, checkout and order pages are M3 scope (rewrites already in place).

## M6 — Product photos (image pipeline) ✅ (2026-10-17)

Done
- `scripts/images/` behind `npm run images` (`tsx scripts/images/generate.ts`):
  `prompt.ts` (pure: view per image index front/side/back/detail/lifestyle, German
  colour/material translated into the prompt, no brand names, no logos/text/watermark,
  deterministic FNV-1a seed per `<slug>-<n>`), `api.ts` (POST
  `$IMAGE_API_URL` default `http://192.168.10.210:8080/v1/images/generations`, OpenAI
  images shape `{ prompt, size: "768x768", seed }`, `Bearer $LLAMA_API_KEY`; retries 4×
  with 1 s/2 s/4 s backoff on network errors/429/5xx, other 4xx fail fast; b64_json or
  url → sharp → WebP), `generate.ts` (walks all product image slots sorted by slug,
  writes `public/products/<slug>-<n>.webp`, records path + German alt on the product
  document, repairs drifted paths, `--limit N` counts only actual generations, one
  progress line per image, exit 0 iff no failure; missing `LLAMA_API_KEY` → clear error).
- `sharp@0.35.5` declared as a dependency (was already in `node_modules` via Next).
- Storefront: `product-image.tsx` + pure `lib/images.ts` (`isPhotoSrc`) — photo extensions
  render `<img>`, anything else (seed `.svg`) renders a neutral muted placeholder; used in
  product cards, gallery (main/thumbs/zoom dialog), instant search and cart drawer, so
  photos appear everywhere product images show and no cartoon SVG is ever rendered.
- Docs: PLAN M6, ARCHITECTURE §11 + §2, DECISIONS (WebP normalization, view/colour
  assignment, FNV-1a seed, file-based idempotency, placeholder rule).

Verified (acceptance)
- `npm run images -- --limit 2` → 2 new valid WebP files (`file` reports RIFF WebP
  768×768), documents updated, progress lines, exit 0; re-run printed
  "skipped (already on disk)" for them (skips do not consume `--limit`), exit 0.
  4 images total exist (`adidas-gazelle-071-1…4.webp`) — the lead runs the full
  generation after the gate (576 slots).
- Background `npm run start`: `/produkt/adidas-gazelle-071` HTML has 5 `<img>` sources
  all `/products/…-<n>.webp` with German alts ("… – Frontansicht"); listing HTML contains
  0 `<img>` with `.svg` sources — products without photos render the neutral placeholder
  (`role="img"` + aria-label); `.svg` paths appear only in the RSC data payload, never in
  image markup. Server + mongod stopped again.
- `npm run build` ✅ (no mongod, no env); `npm run lint` ✅; `npm test` ✅ 100 tests /
  11 files (new `tests/image-pipeline.test.ts`: views, seed determinism/range, prompt
  content incl. no-brand/no-logo/no-text, German alts, `isPhotoSrc`).

Open / known issues
- Full generation (576 slots) is the lead's run after the gate; until a slot's photo
  exists its product shows the neutral placeholder.
- The 4 proof images are gitignored (`public/products/*`) like all generated content.

### M6 gate fix — storefront showed SVGs after the full batch ✅ (2026-10-17)

Root cause
- `seedProducts` upserted products with `$set: product`, so any `npm run seed` re-run
  **after** the image batch reset every `images[].src` back to the seed `.svg` paths
  (files on disk untouched) — exactly the gate state: 576 `.webp` on disk, all 576
  documents pointing at `.svg`.

Fix
- `scripts/seed/seed.ts`: `images` moved to `$setOnInsert` — re-seeding an existing
  product never clobbers recorded photo paths again (SVGs are still (re)written to disk).
- `scripts/images/generate.ts`: `LLAMA_API_KEY` is only required when a slot actually
  needs generation; a pure skip/repair run works without the key (clear error otherwise).
- Repaired the live DB with `npm run images` (all 576 slots on disk → 0 generated,
  576 skipped, every drifted `.svg` path rewritten to `.webp` + German alt, exit 0;
  zero image-API calls).

Verified
- DB after repair: 576/576 `images[].src` end in `.webp`; a subsequent idempotent
  `npm run seed` keeps them at 576/576 `.webp`.
- Background `npm run start`: `/produkte?type=smartphone` → 24 product `<img>` sources,
  all `/products/…webp`, 0 `.svg`; `/produkt/apple-iphone-16-pro-070` → gallery + thumbs
  reference `/products/apple-iphone-16-pro-070-1.webp` (was `.svg`), 5 webp `<img>`s,
  0 `.svg`; `GET /products/apple-iphone-16-pro-070-1.webp` → 200 `image/webp`.
  Server + mongod stopped again.
- `npm run build` ✅, `npm run lint` ✅, `npm test` ✅ 155 tests / 17 files.

## M3 — Cart, checkout, orders ✅ (2026-10-17)

Done
- Cart page `/warenkorb` (`cart/page.tsx` + `cart-page-view.tsx`) mirroring the drawer: line
  items with qty steppers (clamped to stock), remove, free-shipping progress bar (free ≥ CHF
  100, standard 4.90 / express 12.90 — already recorded in DECISIONS), sticky summary with
  "Zur Kasse"; empty state with CTA.
- Checkout `/kasse`: single column with 3 anchored steps (Adresse → Versand → Zahlung),
  zod-validated client + server (`lib/validations/checkout.ts` — name/email/phone/street/
  4-digit PLZ/city, shipping method enum), shipping method radio cards with live prices,
  mock payment card stub (demo, not sent), sticky summary sidebar with `computeTotals`.
- `createOrderCore` (`src/server/checkout.ts`): one MongoDB transaction re-checks stock and
  decrements variants via `findOneAndUpdate` with a `stock ≥ qty` guard, mints
  `orderNumber` from the Counter (`B-YYYY-######`, gap-free, inside the transaction),
  inserts the order `new` → mock payment → `paid` (state-machine `transition`, both
  `statusLog` entries), commits; insufficient stock / unknown sku abort and write nothing;
  transient write-conflicts retried ≤ 3×, then a clean `{ ok: false, error }`.
- Thin Server Action `createOrderAction` (`server/actions/checkout.ts`): JSON payload →
  zod → `createOrderCore`; checkout form uses `useActionState`, toasts errors, clears the
  cart and routes to the confirmation on success.
- Confirmation `/bestellung/[nummer]` (`order/[number]/page.tsx` + `server/orders.ts`
  `getOrderByNumber`): status timeline over the state-machine chain with timestamps,
  cancelled banner, items, totals with VAT note "8,1 % MwSt. inbegriffen", payment
  reference, tracking number + parcel weight once shipped, delivery address; unknown
  numbers render the 404 UI.
- Stock edge cases: out-of-stock variants block add-to-cart (M2 guard, kept), last-item
  race fails cleanly through the transaction guard (error toast, nothing written).

Verified (acceptance — integration tests call `createOrderCore` directly)
- Valid order → `B-YYYY-######` (`formatOrderNumber`), status `paid` with `statusLog`
  `["new","paid"]`, `payment.paidAt` set, totals equal `computeTotals`, variant stock
  decreased by the ordered qty; second order gets the next gap-free number.
- Ordering more than available stock → `{ ok: false }`, stock, orders and counter all
  unchanged (transaction abort); unknown sku and invalid customer rejected.
- Concurrent last-item race (stock 1, two parallel `createOrderCore`): exactly one
  succeeds, stock ends at 0, exactly one order written.
- Cart store survives reload: `cart:v1` serialize/deserialize round-trip + hydrate tests
  (M2 suite, still green).
- Background `npm run start` + curl: `/warenkorb` 200, `/kasse` 200,
  `/bestellung/B-2026-000001` 200 showing the number (11×), status "Bezahlt", timeline and
  "8,1 % MwSt. inbegriffen"; server + mongod stopped again.
- `npm run build` ✅ (no mongod, no env); `npm run lint` ✅; `npm test` ✅ 108 tests /
  12 files (new `tests/create-order.test.ts`: 8 tests).

Open / known issues
- With `cacheComponents`/PPR a streamed `notFound()` keeps HTTP 200 (documented Next 16
  behaviour) — unknown order/product URLs render the 404 UI with `noindex`; same as the
  M2 product page.
- Mock payment fields are a UI stub only (never validated or persisted) by design.

## M4 — Admin: auth, orders, packing, shipping ✅ (2026-10-17)

Done
- Auth: `server/session-token.ts` (pure HMAC-SHA256 cookie `<base64url(payload)>.<base64url(mac)>`,
  payload `{ userId, exp }` 12 h, `timingSafeEqual`) + `server/session.ts` (scrypt verify via
  `server/password.ts`, in-memory login throttle 5/15 min per IP+account, cookie helpers,
  `requireAdminSession`); `/admin/login` card with demo-credentials hint; logout in sidebar.
  `src/proxy.ts` (Next 16 Proxy, Node runtime) guards every `/admin/*` request **before
  rendering** with a real 307 → `/admin/login` (with `cacheComponents`/PPR a `redirect()`
  thrown during render only streams a client-side `NEXT_REDIRECT` under HTTP 200 — the layout
  guard stays as defense in depth, the proxy makes the redirect a real HTTP redirect).
- Orders: `/admin/orders` status tabs with counts + table; detail with status timeline,
  allowed-transition buttons (server-validated) → `transitionOrderCore`
  (`server/orders-admin.ts`: state-machine transition + logged timestamps in one transaction;
  cancel from `new`/`paid`/`picking` restocks the variant lines in the **same transaction**;
  illegal edges throw `IllegalTransitionError`, mapped to a German toast in the action).
- Packing: queue of `picking`/`packed` orders; per order pick list sorted by sku with
  per-line weight and parcel weight (Σ qty×weight + 150 g), printable slip (`print-slip` +
  `@media print` rules in `globals.css` hide sidebar/header/footer), Drucken button.
- Shipping: `lib/shipping/types.ts` (`ShippingProvider`, `LabelRequest/Result`,
  `MOCK_TRACKING_PATTERN`); factory `server/shipping/provider.ts` (UPS only when
  `UPS_CLIENT_ID/SECRET/ACCOUNT` all set); `UpsShippingProvider` (OAuth client-credentials
  token cached until `expiresIn − 60 s` with single-flight refresh, Shipping API 2
  `v2409/ship`, PDF label decode, typed error mapping — endpoints pinned in DECISIONS,
  verified against the Karrio UPS connector because `developer.ups.com` is unreachable from
  this network); `MockUpsProvider` (`1Z…` tracking, pdf-lib label → `data/labels/`);
  `createLabelCore` (only from `packed`, idempotent, provider must succeed before the
  conditional `packed → shipped` move, writes `data/labels/<orderNumber>.pdf` outside the web
  root); behind `createLabelAction` **and** `POST /api/shipping/label/[orderId]`
  (same-Origin check → 403, session → 401); label served only by session-guarded
  `GET /admin/labels/[orderId]` (path-traversal-checked, invalid id → 404).
- Label button on packing + order detail; tracking + parcel weight + label link shown on the
  customer confirmation once shipped.

Verified (acceptance)
- Background `npm run start`: `/admin` and `/admin/orders` without cookie → **307 →
  /admin/login**; forged cookie → 307; expired cookie (signed, `exp` past) → 307; login page
  200. `loginCore` with the seeded credentials (run against the live dev mongod) returned a
  token that fetched `/admin`, `/admin/orders`, `/admin/packing` → 200.
- `POST /api/shipping/label/…` with forged `Origin` (and with no `Origin`) → 403; same
  `Origin` without session → 401. `GET /admin/labels/…` without cookie → 307; with cookie →
  200 `application/pdf` starting `%PDF-`; invalid order id → 404.
- Live mock flow on seeded order `B-2026-000009` (`packed`): tracking `1ZTBCFX4D62UTHA6ZN`
  (`^1Z[0-9A-Z]{15,16}$`), PDF `%PDF-` at `data/labels/B-2026-000009.pdf`, order `shipped`,
  `shipping.parcelWeightGrams` = Σ qty×weight + 150; second call returned the identical
  tracking + label path; `/bestellung/B-2026-000009` shows the tracking number.
- Packing slip HTML contains every line's sku/name/variant/qty/weight + parcel weight incl.
  150 g; served CSS contains the `@media print` block.
- `npm test` ✅ 139 tests / 15 files — new: `tests/session.test.ts` (token round-trip, forged
  signature/payload/secret, expiry, `loginCore` seeded credentials, wrong password, throttle
  after 5 failures), `tests/order-transitions.test.ts` (`paid → picking → packed` one logged
  entry per step, `IllegalTransitionError` for `packed → paid` and same-state with nothing
  written, cancel-restock from `new`/`paid`/`picking`, no cancel from `packed`/`shipped`),
  `tests/shipping.test.ts` (mock tracking pattern + `%PDF-`, UPS provider with mocked fetch:
  token caching/refresh/single-flight, success mapping, API + auth error mapping, factory
  selection by env, `createLabelCore` from packed / idempotent / rejected from `paid` /
  provider failure keeps `packed`).
- `npm run build` ✅ (no mongod, no env); `npm run lint` ✅; server + mongod stopped again.

Open / known issues
- `SESSION_SECRET` unset falls back to a fixed dev secret (documented in DECISIONS; the app
  is a single-process demo with public credentials — production must set it).
- UPS endpoints could not be verified against `developer.ups.com` (network-blocked); pinned
  from the maintained Karrio connector instead (DECISIONS) — the real provider is only
  exercised once credentials are provided.
- `/admin` dashboard is a section launcher; KPI cards/low-stock table are M5 scope.

## M5 — Purchasing, dashboard, polish ✅ (2026-10-17)

Done
- Purchasing: `server/purchasing.ts` core (`createSupplierCore`/`updateSupplierCore`,
  `createPurchaseOrderCore` minting `E-YYYY-######` from the Counter in a transaction,
  `markPurchaseOrderOrderedCore`, `receivePurchaseOrderCore` incrementing variant stock by
  `qty − received` per line in one transaction, `searchVariantsBySku` regex-escaped SKU
  search) behind thin actions in `server/actions/admin/purchasing.ts`. `/admin/purchasing`
  (PO list with status chips + PO editor: supplier select, debounced SKU search, qty/price
  lines, live total), `/admin/purchasing/[id]` (lines, "Bestellen" draft→ordered,
  "Wareneingang" ordered→received with delta toast), `/admin/suppliers` (list + create +
  edit via `?bearbeiten=<id>`; deactivate via `active`, no delete — DECISIONS).
- Dashboard `/admin`: KPI cards Umsatz 30 Tage (statuses `paid|picking|packed|shipped|
  delivered`, UTC-day buckets), Offene Bestellungen, Lieferungen ausstehend; pure-SVG
  `RevenueSparkline` (30 points, aria-label, no chart lib); low-stock table
  (`stock ≤ restockThreshold` via the pure `isLowStock`, sorted by stock, empty state);
  recent orders (newest first). Sidebar now: Dashboard/Bestellungen/Kommissionierung/
  Einkauf/Lieferanten.
- Polish: global German 404 (`app/not-found.tsx`, noindex) used by every `notFound()`;
  root metadata `metadataBase` + Open Graph (`de_CH`, `NEXT_PUBLIC_SITE_URL`); skip-to-content
  link in the storefront layout; defined the `.chip` class the mobile header nav used but
  never existed (unstyled links); empty/loading states on all new pages; focus-visible rings
  on every new interactive element.
- README final: admin section, env-var table (production `MONGODB_URI` + replica-set
  requirement, `SESSION_SECRET`, `UPS_*`, `NEXT_PUBLIC_SITE_URL`, `MONGOMS_SYSTEM_BINARY`).

Verified (acceptance)
- Integration test `tests/purchasing.test.ts` (12 tests): PO for 2 SKUs × qty →
  `receivePurchaseOrderCore` → variant stocks increased exactly by the ordered qty (4→10,
  4→15), lines `received = qty`, status `received` with `receivedAt`; receive from `draft`
  rejected, second receive rejected (stock unchanged), missing product aborts the whole
  transaction (PO stays `ordered`, nothing incremented); `E-YYYY-######` gap-free from the
  counter; supplier create/duplicate/update/unknown; SKU search.
- Integration test `tests/dashboard.test.ts` (4 tests): revenue = exactly the sum of
  `paid|picking|packed|shipped|delivered` orders within 30 days (excludes `new`,
  `cancelled`, day-40), > 0 with clock-relative seeded orders; series length 30 and sums to
  the total; low-stock table compared against the expected set computed from `isLowStock`
  over all seeded variants; recent orders sorted newest-first.
- Cancel-restock from `paid` and "no cancel from `shipped`" — covered by the M4 suites
  (`tests/order-transitions.test.ts`, `src/lib/orders/state-machine.test.ts`), still green.
- axe-core 4.14 scan (jsdom, rendered HTML of the running production server) of
  home / listing / product: **0 violations, 0 critical** (37/35/35 passes; `color-contrast`
  not executable in jsdom — no canvas — contrast comes from the shadcn token palette).
- Full smoke: `npm run seed` (idempotent, 200/15/3/3) → background `npm run start` →
  `/` 200, `/produkte?type=shoes&size=42` 200, `/produkt/apple-iphone-16-pro-001` 200,
  `/bestellung/B-2026-000001` 200, `/admin` without cookie → 307 `/admin/login`; with a
  `loginCore`-signed cookie: `/admin` 200 showing Umsatz **CHF 12'633.90** (> 0), sparkline,
  low-stock rows, recent orders; `/admin/purchasing` 200 with `E-2026-000001…000003` +
  status chips; PO detail 200; `/admin/suppliers` 200 with the seeded suppliers. Server +
  mongod stopped again.
- `npm run build` ✅ (no mongod, no env); `npm run lint` ✅; `npm test` ✅ 155 tests /
  17 files.

Open / known issues
- Suppliers have no delete (deactivation via `active`) — deliberate, see DECISIONS.
- The PO editor's unit-price field accepts any non-negative CHF amount; supplier lead time
  is displayed but not enforced anywhere.

## QA — review fixes, admin products, e2e ✅ (2026-10-17)

Done
- **B1 (blocker):** checkout stock guard fixed — `decrementStock` now uses
  `variants: { $elemMatch: { sku, stock: { $gte: qty } } }` so guard and decrement hit the
  same variant (`src/server/checkout.ts`); regression test: multi-variant product, ordered
  variant at 0 with a well-stocked sibling → order fails, nothing moves
  (`tests/create-order.test.ts`).
- **B2 (blocker):** admin product management implemented — `/admin/products` (debounced
  search incl. exact SKU lookup, inline stock edit) and `/admin/products/[id]` (core form,
  variant table with price delta/stock/weight/attributes, image strip, featured toggle)
  behind `updateProductCore`/`updateVariantCore`/`toggleFeaturedCore`
  (`src/server/products-admin.ts`, `src/server/actions/admin/products.ts`), every
  variant-touching write recomputes `filter` via `deriveFilter`; sidebar entry added;
  integration test asserts "edit a variant's colour → listing facet reflects it"
  (`tests/admin-products.test.ts`).
- **Majors M1–M8:** `transitionOrderCore` now writes conditionally on the validated status
  (`updateOne({ _id, status: from })`, `matchedCount === 0` → clean conflict) and restocks
  only after the move won; `tests/checkout-transaction.test.ts` deleted (duplicated the
  buggy query; coverage lives in `tests/create-order.test.ts`); text index dropped (search
  is the regex prefix, docs corrected); dead code/exports/files/deps removed
  (`ORDER_NUMBER_YEAR`, `checkoutPayloadError`, `canFulfill`/`applyDelta`, unused UI
  components + `vaul`, `@vitejs/plugin-react`, `deriveFilter` re-export, …) and duplicated
  helpers deduplicated (`src/server/numbers.ts` `mintNumber`, shared tracking generator,
  `src/lib/regex.ts`); `z.coerce.boolean()` → `z.boolean()`; mega-menu brands synced with
  the catalog and enforced by `tests/mega-menu.test.ts`; JSON-LD escapes `<` (`\u003c`);
  ARCHITECTURE reconciled with the tree (§1/§2/§3/§6/§8 + new §12 e2e).
- **Minors:** actor = session user's e-mail in the order log; label path containment via
  `path.relative`; typed `reason` from `createLabelCore` (no German-substring status
  mapping); label PDF written only after the conditional move wins; health endpoint returns
  a generic message; dummy-hash verify for unknown accounts (no timing oracle); bounded
  throttle sweep; `SESSION_SECRET` through the env schema with empty-string preprocessing;
  `?edit=`; `z.email()`; visible "neuesten 200" caps; stock-level thresholds moved to
  `src/lib/stock.ts` (`stockLevel`); `suppressReservedKeysWarning`; `makeOrderFixture`
  (no `as never`); mega-menu Escape + focus-visible; `next-env.d.ts` committed; exact
  dependency pins; README images/e2e/env sections; session-outlives-user and list caps
  recorded in DECISIONS. Not fixed (deliberate, reasons in CODE-REVIEW "Resolution"):
  revenue `paidAt` bucketing (worded instead) and per-order in-flight label dedupe.
- **E2E (Playwright 1.64.1, Chromium only):** `tests/e2e/` + `npm run test:e2e` — global
  setup requires a production build, starts a throw-away replica set, seeds it fresh
  (`--fresh`, own `MONGODB_URI`), runs `next start` on port 3100 and tears down. Specs:
  storefront (browse → filter → product page with gallery + variant → cart → checkout →
  confirmation with `B-YYYY-######`), admin shipping (login → picking → packed → mock UPS
  label → shipped, tracking shown on the confirmation), purchasing (PO Wareneingang →
  variant stock up by exactly the ordered qty). 3/3 green.

Verified
- `npm run build` ✅, `npm run lint` ✅, `npm test` ✅ (unit + integration, throw-away
  replica set), `npm run test:e2e` ✅ 3/3 against the production build on port 3100 with a
  freshly seeded database.

## BUG1 — admin login loop on LAN addresses (issue #1) ✅ (2026-10-17)

Root cause
- `setSessionCookie` set the session cookie `Secure` whenever `NODE_ENV === "production"`.
  Browsers only store `Secure` cookies on trustworthy origins (https + localhost/127.*), so
  on `http://<lan-ip>:4000` Chrome silently dropped the cookie after a successful login and
  the proxy redirected to `/admin/login` on every following admin request; on
  `http://localhost:4000` the same build worked because localhost is trustworthy.

Fix
- `resolveSessionCookieSecure` (`src/server/session.ts`): `Secure` is decided per login
  request — explicit `SESSION_COOKIE_SECURE=true|false` env (added to `env.ts` + README)
  wins, else the request's own protocol (`x-forwarded-proto`, then the browser's
  `Origin`/`Referer` scheme), else the old `NODE_ENV` default. Over https the cookie stays
  `Secure` exactly as before; trade-off recorded in DECISIONS.

Verified
- New e2e `tests/e2e/admin-session.spec.ts`: Chromium maps a non-localhost hostname to
  loopback (`--host-resolver-rules`) and drives login + `/admin/orders` + `/admin/products`
  + `/admin/purchasing` over plain HTTP, asserting the stored cookie is not `Secure` —
  **fails on the pre-fix build** (redirect to `/admin/login`), green with the fix.
- `npm run build` ✅, `npm run lint` ✅, `npm test` ✅ 158 tests / 18 files,
  `npm run test:e2e` ✅ 4/4.

## Next

Done — M1–M6 + QA complete.

## ISSUES — queue session 1 (2026-10-17)

### #2 — forgeable admin sessions without SESSION_SECRET ✅
- `resolveSessionSecret` (pure, unit-tested): production **requires** `SESSION_SECRET`
  (≥ 32 chars) — missing/weak throws at first use instead of falling back to a
  source-code secret; outside production a random per-process secret (globalThis-cached,
  HMR-safe) replaces the fixed dev secret.
- `resolveSessionUserId`: after the signature check the user must exist in the DB —
  tokens for unknown/deleted users are rejected (tests cover all three paths).
- e2e global setup signs with a fresh random `SESSION_SECRET` (production start).
- Verified: `npm test` ✅ 167, lint/build ✅, `npm run test:e2e` ✅ 4/4.

### #3 — order confirmation exposed every customer's PII ✅
- `src/server/order-access.ts`: per-order HMAC access cookie (granted by the checkout
  action, 30 d) + `verifyOrderEmailCore` (case-insensitive, throttled 10/h/order, no
  order-enumeration oracle); `verifyOrderEmailAction` behind the new
  `OrderAccessForm` on the page. `/bestellung/[number]` renders items/totals/address/
  contact/tracking only for the access cookie or a signed-in admin — strangers get
  number + status + the e-mail form, no PII in the HTML at all.
- Verified: `tests/order-access.test.ts` (8 tests), e2e `order-privacy.spec.ts`
  (stranger/wrong e-mail/correct e-mail/reload), full e2e ✅ 5/5, `npm test` ✅ 175,
  lint/build ✅.

### #4 — admin password public and reset by every seed ✅
- Seed: `ADMIN_PASSWORD` env or a random once-printed password; existing admin's password
  survives re-seeds (`$setOnInsert`); login page hint is dev-only; new
  Dashboard „Passwort ändern" (`changePasswordCore` + action + form).
- Verified: `tests/seed-user.test.ts` (3), `changePasswordCore` tests (3), e2e asserts the
  production login page contains no password; full e2e ✅ 5/5, `npm test` ✅ 181,
  lint/build ✅.

### #5 — login throttle bypassed via X-Forwarded-For ✅
- Account-keyed throttle + untrusted XFF by default (`TRUST_PROXY_HEADERS` opt-in, last
  entry), scrypt limiter (2 parallel / queue 8, busy error beyond).
- Verified: `tests/limiter.test.ts` (3), `resolveClientIp` + cross-IP account-throttle
  tests; `npm test` ✅ 188, lint/build/e2e ✅ 5/5.

### #6 — logout left the token valid for 12 h ✅
- `iat` in the session payload + `sessionsInvalidBefore` on the user; `revokeSessionsCore`
  on logout and on password change; enforced in `resolveSessionUserId`.
- Verified: revocation tests (logout, fresh token after, password-change sign-out) +
  e2e: copied cookie gets a real 307 after logout; `npm test` ✅ 190, e2e ✅ 6/6.

### #7 — no security headers; Secure flag trusted a Next-filled header ✅
- Global nosniff/Referrer-P/frame-ancestors 'none'+X-FRAME-OPTIONS DENY/HSTS, poweredBy off;
  `x-forwarded-proto` only trusted with `TRUST_PROXY_HEADERS` (pure
  `decideSessionCookieSecure` + tests).
- Verified: e2e `security-headers.spec.ts`, 4 decision tests; `npm test` ✅ 194, e2e ✅ 7/7.

### #8 — scripted checkouts could drain all stock ✅
- Caps 20 lines / 10 per line / 10 per SKU (merged) in `checkoutSchema`; rate limit
  10 orders/10 min per client in the checkout action (`src/server/rate-limit.ts`).
- Verified: `tests/checkout-limits.test.ts` (7); `npm test` ✅ 201, build/e2e ✅ 7/7.

### #9 — unvalidated server-action inputs → 500s ✅
- `objectIdSchema` shared; purchasing/products/orders/shipping actions zod-validated;
  `searchSkuAction(unknown)` → `[]` on junk.
- Verified: `tests/action-validation.test.ts` (4, incl. the number-query repro);
  `npm test` ✅ 205, lint/build/e2e ✅.

### #10 — manual packed → shipped skipped the label ✅
- Label-only transition: `viaLabel` required in the state machine, excluded from
  `allowedTransitions` (no "→ Versandt" button on packed orders).
- Verified: state-machine + `transitionOrderCore` tests; e2e shipping journey ✅.

### #11 — parallel checkouts failed on counter write conflicts ✅
- Transient-retry loop: 6 attempts with exponential backoff + jitter (was 3 immediate).
- Verified: new integration test — 10 parallel checkouts, all succeed, unique gap-free
  numbers, stock exact; `npm test` ✅ 209, e2e ✅ 7/7.

### #12 — checkout could charge a different price than displayed ✅
- Every checkout line now carries `expectedUnitPriceCents` (the cart/displayed price,
  required by `checkoutLineSchema`); `createOrderCore` compares it against the current DB
  price **before** decrementing stock and refuses with `reason: "price_changed"` + the
  current prices (duplicated SKUs: the lower expectation wins); the form shows a warning
  toast and `syncPrices` adopts the new prices in the cart so the re-confirmed total is
  what will be booked.
- Verified: `tests/create-order.test.ts` price-change test (stale price refused, stock
  untouched; raise → refused with new price; after sync → booked at exactly that price),
  schema test (line without price rejected); `npm test` ✅ 211, lint/build ✅, e2e ✅ 7/7.

### #33 — security-critical code had no tests ✅
- Extracted the two inline security decisions into pure, tested functions:
  `isSameOrigin` (`src/server/same-origin.ts`, used by the label API route) and
  `resolveInsideDir` (`src/server/secure-path.ts`, used by the label download route).
- New `tests/security-routes.test.ts`: proxy guard (login open, no/forged/empty cookie →
  307, valid token through), same-origin (own origin through; foreign/port-mismatch/
  missing/malformed refused), label path containment (inside through; traversal,
  absolute, sibling-prefix, directory itself and empty refused), and DB-backed guards:
  `getSessionUserId` (valid/anonymous/deleted user), `requireAdminSession` (NEXT_REDIRECT
  to /admin/login vs. user id), `getAdminEmail` (user/null) — via a mocked `next/headers`.
- `decideSessionCookieSecure` remaining branches covered in `tests/session.test.ts`
  (explicit-false override, trusted x-forwarded-proto both ways, unparseable
  origin/referer, dev default).
- Verified: `npm test` ✅ 230, lint/build ✅, e2e ✅ 7/7.

### #32 — routes were not thin anymore ✅
- Label download: look-up, path containment and file read moved into
  `getLabelFileCore` (`src/server/shipping/label.ts`); the route keeps only the session
  guard and response mapping. Covered by 3 new integration tests in
  `tests/shipping.test.ts` (serves PDF, refuses escaping paths, 404s).
- Order confirmation: its private `StatusBadge`/`Timeline` are gone — the page uses the
  shared `OrderStatusBadge` (same tones as the admin now) and the new
  `OrderStatusChain` component (`src/components/storefront/order-status-chain.tsx`),
  which renders the new `HAPPY_PATH` from the state machine.
- Admin products page: `?q/?type/?page` parsed by `adminProductsQuerySchema`
  (`src/lib/validations/listing.ts`, junk falls back to unset) instead of hand casts;
  3 schema tests.
- Verified: `npm test` ✅ 236, lint/build ✅, e2e ✅ 7/7.

### #31 — one source per concept ✅
- `src/lib/numbers.ts`: `formatOrderNumber`/`formatPoNumber`/`formatPaymentReference` —
  checkout, purchasing and the seed all call them instead of re-spelling `B-`/`E-`/`P-`
  templates; `src/lib/brands.ts`: `CATALOG_BRANDS` is now the single brand set used by
  the seed generator (weighted list derived from it, plus a module-load guard that every
  brand has models) and by the mega-menu (`MENU_CATEGORIES`).
- Happy-path status chain: `HAPPY_PATH` exported from the state machine; the hand copies
  in `scripts/seed/seed.ts` and the three test files are gone.
- Product-type labels: the copies in `listing-shell.tsx` (tabs derived from
  `MENU_CATEGORIES`), the home page tiles, the product page breadcrumbs and the
  header/footer chips all render `PRODUCT_TYPE_LABELS` from `src/lib/menu.ts`.
- Verified: `npm test` ✅ 236 (mega-menu sync test still green), `npm run seed` ✅
  idempotent, lint/build ✅, e2e ✅ 7/7.

### #30 — VAT and shipping rules lived in the UI ✅
- `src/lib/pricing.ts` gained `VAT_LABEL`/`VAT_INCLUSIVE_NOTE` (derived from
  `VAT_RATE_PERCENT`, German comma) and `freeShippingProgress(subtotal)`; all 11
  hard-coded „8,1 % MwSt." strings (pages, metadata, footer, product detail, order
  confirmation) now interpolate them — change the rate, the copy follows.
- Checkout shipping cards use `shippingCents()` instead of re-implementing the free
  threshold; the copy-pasted free-shipping progress bar in cart drawer and cart page
  became the shared `FreeShippingProgress` component over the lib rule.
- Verified: 2 new rule tests in `src/lib/pricing.test.ts`; `npm test` ✅ 238,
  lint/build ✅, e2e ✅ 7/7.

### #29 — dead SVG generator removed ✅
- `scripts/seed/svg.ts` deleted; the seed writes no image files anymore. Catalog slots
  are recorded with their final photo paths (`/products/<slug>-<n>.webp`) — the photo
  pipeline owns `public/products/`.
- `ProductImage` (now client) and the gallery main image fall back to the neutral
  placeholder via `onError` while a slot's file does not exist yet — the visible
  behaviour for un-photographed products is unchanged.
- README + ARCHITECTURE §2/§3/§10/§11 corrected (no SVG mentions left); new test asserts
  every catalog slot is a photo path; e2e gallery assertion works with loaded photos and
  placeholders alike.
- Verified: `npm test` ✅ 239, `npm run seed` ✅, lint/build ✅, e2e ✅ 7/7.

### #23 — home page shows the featured collections ✅
- `src/lib/collections.ts` (`Neuheiten | Bestseller | Sale`) is the single source for the
  seed, the listing `?collection=` filter (`listingParamsSchema`,
  `buildListingFilter`), the new home-page `Collections` section (up to 4 products per
  collection via `getCollectionProducts`, each linking to the filtered listing) and the
  mega-menu/hero „Neuheiten" links. The listing shows an active-collection chip that can
  be removed.
- Verified: `tests/collections.test.ts` (4); `npm test` ✅ 243, lint/build ✅, e2e ✅ 7/7.

### #20 — listing prices are prices you can actually pay ✅
- `buyablePriceCents(base, deltas)` in `src/lib/pricing.ts`: the cheapest real variant
  price, plus a `from` flag when other variants cost more. `toProductDto` exposes
  `minPriceCents`/`priceFrom`, search hits carry the same — product cards and instant
  search show „ab CHF 504.00" instead of the unreachable base price.
- Verified: 3 pure tests (incl. the Pixel 9a repro) + 2 integration tests;
  `npm test` ✅ 248, lint/build ✅, e2e ✅ 7/7.
