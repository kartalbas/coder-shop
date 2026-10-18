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

## ISSUES — queue session 2 (2026-10-17)

### #26 — accessibility problems found by axe and keyboard testing ✅
- Breadcrumbs: the wrapper `<span>` around each entry was invalid inside the `<ol>` —
  now `BreadcrumbItem` (`<li>`) itself is the flex wrapper.
- Contrast: stock indicator and admin order/PO status badges moved from `*-600` to
  `*-700` text tones (≥ 4.5:1 on the light background; dark mode keeps 400).
- Gallery: main image is focusable and opens the zoom dialog with Enter/Space; a drag
  no longer triggers the click-to-zoom; prev/next arrows appear on keyboard focus
  (`group-focus-within`/`focus-visible`).
- Instant search: options are `tabIndex={-1}` (the combobox owns keyboard navigation
  via `aria-activedescendant`), and a "Keine Treffer für …" status appears instead of
  silence when nothing matches.
- Sheet/dialog close buttons are labelled „Schliessen" (was English "Close"); the
  listing got the `<h1>` it never had (active collection or product type); the
  accordion header renders `h2` instead of Radix's `h3` so heading order stays valid.
- Verified: new e2e `tests/e2e/a11y.spec.ts` (5 tests: h1, `<li>`-only breadcrumbs,
  keyboard zoom + German close label + focus-visible arrows, no-hits message +
  no tab stops in options, 700 contrast tones) — fails on the pre-fix build;
  `npm test` ✅ 274, lint/build ✅, `npm run test:e2e` ✅ 13/13.

### #27 — cart and checkout rough edges ✅
- No empty-cart flash: `useCartHydrated()` (store) — `/warenkorb` and `/kasse` render a
  skeleton until the persisted cart is loaded instead of rendering the empty state and
  swapping.
- Empty `/kasse` has a single `<h1>` (the page's „Kasse"; the form's empty message is no
  longer a heading) and its „Weiter einkaufen" is a client-side `Link`, not a
  full-reload `<a>`.
- The drawer's „Zur Kasse" now goes to `/kasse` (was `/warenkorb`).
- Mock card fields carry no `name` attributes — card data is a UI stub and is never
  part of the submitted form data.
- Verified: new e2e `tests/e2e/cart-checkout.spec.ts` (5 tests: no empty-state flash on
  reload of either page via a MutationObserver that records any appearance of the
  empty text, one `<h1>` on empty/filled `/kasse`, drawer → `/kasse`, card inputs have
  no `name`) — fails on the pre-fix build; `npm test` ✅ 274, lint/build ✅,
  `npm run test:e2e` ✅ 18/18.

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

### #19 + #18 — product page: colour-true photos, deliberate add-to-cart ✅
- New pure `src/lib/product-selection.ts` (7 unit tests): `dimensionsOf`,
  `matchesSelection`, `missingDimensions`, `slotColor`/`imageIndexForColor` — the photo
  slot a colour was generated for (the generator's `variant i % count` rule) is now what
  the gallery shows, so choosing „grün" shows green photos and storage changes no longer
  move the picture (#19).
- A concrete variant exists only after every dimension is chosen; until then the price
  shows „ab CHF …" and the button is disabled and names what is missing
  („Bitte Farbe / Grösse wählen") instead of adding a random variant (#18).
- e2e storefront spec asserts the disabled-then-enabled add-to-cart flow.
- Verified: `npm test` ✅ 255, lint/build ✅, e2e ✅ 7/7.

### #25 — listing: one request per change, cached photos, sized images, scroll ✅
- `ListingShell` no longer fetches `/api/products` in parallel to the router re-render —
  the `router.replace` navigation already carries the new server-rendered data, so every
  filter/sort/page change is exactly one request (`useTransition` drives the skeleton).
  `/api/products` stays as the documented JSON API (ARCHITECTURE §4).
- Generated photos (`/products/*.webp|jpg|…`) get `Cache-Control: public, max-age=86400,
  stale-while-revalidate=604800` via `next.config.ts` instead of `max-age=0`.
- `ProductImage` emits a `srcSet` over the image optimizer (128/256/384/640 w) with a
  `sizes` hint — cards pick a slot-sized variant (verified: 1.5 KB at 128 w vs 40 KB
  full-size); gallery thumbs ask for 64 px, the zoom dialog for up to 768 px.
- Changing the page scrolls the grid back to the top.
- Verified live (`npm run start` + curl): photo header, `srcSet` in listing HTML,
  optimizer 200 `image/jpeg`; `npm test` ✅ 274, lint/build ✅, e2e ✅ 8/8.

### #24 — filters behave like in a good shop ✅
- Multi-value facets: `brand=Apple,Samsung` (comma lists parsed by `listingParamsSchema`,
  `$in` in `buildListingFilter`), checkboxes now really toggle list members.
- Facet counts respect the other active filters (each facet is counted over the filter
  without its own condition), so counts match the result a click would produce.
- Natural order via pure `src/lib/facet-order.ts`: EU sizes/storage numeric, clothing
  sizes XS→XXL (not alphabetical), numbers before tokens before strings; under "Alle" the
  size facet splits into „Grösse (EU)" and „Grösse (Kleider)" instead of one mixed group.
- Switching the category tab drops all facets — no more 0-product dead ends.
- Verified: `src/lib/facet-order.test.ts` (4), multi-value + count tests + schema parsing
  in `tests/storefront.test.ts`; `npm test` ✅ 274, lint/build ✅, e2e ✅ 8/8.

### #17 — revenue and number years follow Swiss calendar days ✅
- New pure `src/lib/dates.ts`: `swissDayKey`/`swissYear` (Intl, Europe/Zurich),
  `addDaysToDayKey`, `swissDayStartUtc` (DST-safe). The dashboard window is now exactly 30
  Swiss days: `$match` starts at Swiss midnight of the oldest day and `$dateToString`
  buckets with `timezone: Europe/Zurich` — the oldest day is never cut in half and the
  series always sums to the matched revenue. `mintNumber` (orders + POs) and the seed use
  the Swiss year, so an order at 00:30 on 1 January (Zurich) gets the new year.
- Verified: `src/lib/dates.test.ts` (9 tests incl. DST round-trips); dashboard test now
  counts an order at 22:30Z (= 00:30 Zürich) on the oldest day and excludes one an hour
  earlier; number tests use `swissYear`; `npm test` ✅ 267, lint/build ✅, e2e ✅ 8/8.

### #16 — an order ships only with a stored label ✅
- `createLabelCore` writes the label PDF **before** the conditional `packed → shipped`
  move: a failed write returns `reason: "storage_error"` and leaves the order `packed`
  (retryable); a lost race removes the just-written file again.
- Verified: new test in `tests/shipping.test.ts` (unwritable `data/labels` → order stays
  `packed`, no tracking; after chmod, retry ships with a `%PDF-` on disk);
  `npm test` ✅ 262, lint/build ✅, e2e ✅ 8/8.

### #15 — one checkout creates at most one order ✅
- Idempotent checkout: `checkoutFingerprint` (SHA-256 over customer, shipping method and
  merged `sku:qty` lines) keys a `checkout_claims` document (unique `_id`, 1 h TTL) claimed
  **before** the transaction; the winner records its `orderNumber` on the claim, a duplicate
  submit waits for it and returns the same order, and any failure releases the claim so a
  corrected resubmit works. Server-side guarantee, not just the disabled button.
- Verified: `tests/create-order.test.ts` — concurrent + sequential identical submits return
  the same order number with exactly one order and one stock decrement; failed submit
  releases the claim; the last-item race test now uses two customers (real race);
  `npm test` ✅ 261, lint/build ✅, e2e ✅ 8/8.

### #22 — admin can manage product images ✅
- New `ImageEditor` on the product edit page: edit src + Alt-Text per image, reorder
  (up/down), remove, add (1–5 slots, live preview) → `updateImagesCore` (atomic `$set` of
  `images`) behind `updateImagesAction`; `productImagesSchema` enforces 1–5 unique photo
  paths under `/products/` (extension rule shared with `isPhotoSrc`) and non-empty alts.
- Verified: integration test in `tests/admin-products.test.ts` (reorder/alt persisted;
  empty, 6 images, `.svg`, foreign URL, duplicate src and unknown product refused);
  `npm test` ✅ 259, lint/build ✅, e2e ✅ 8/8.

### #21 — admin is usable on tablets and phones ✅
- Shared `ADMIN_NAV` source; below `lg` the panel layout renders a sticky top bar with a
  Sheet menu (hamburger) containing all six sections (current page marked) and logout —
  the sidebar stays as the ≥ `lg` navigation.
- Verified: new e2e `admin-mobile-nav.spec.ts` (820 px: sidebar hidden, sheet opens,
  every section navigates, logout works — fails without the fix); `npm test` ✅ 258,
  lint/build ✅, e2e ✅ 8/8.

### #13 — saving a variant no longer overwrites concurrent stock ✅
- `updateVariantCore`/`updateProductCore` now write with atomic conditional `$set`s instead of
  a whole-document save: a variant save that leaves `stock` at the loaded `expectedStock`
  (new schema field, sent as the editor's loaded value) never touches `stock`; an explicit
  stock edit is applied only while the variant still has `expectedStock` and refused with a
  conflict error otherwise. Core product edits can no longer resurrect stale variant arrays.
- Verified: 2 new regression tests in `tests/admin-products.test.ts` (sale during open editor
  survives an unrelated save; stale explicit stock edit refused, fresh one applied; core save
  keeps concurrent stock); `npm test` ✅ 258, lint/build ✅, e2e ✅ 7/7.

### #14 — re-running the seed no longer resets shop data ✅
- Products, the admin user and suppliers are now written with `$setOnInsert` only — a
  re-run creates what is missing and changes nothing that exists (sold stock, edited
  prices/texts, photo paths all survive); `--fresh` is the only reset. README and
  ARCHITECTURE §11 wording corrected.
- Verified: regression test (edit price/name/stock → re-seed → unchanged);
  `npm test` ✅ 256, lint/build ✅, e2e ✅ 7/7.

## ISSUES — queue session 3 (2026-10-17)

### Gate recovery (before the queue) ✅
- The gate's `/api/health` 500 and link-less `/produkte` were an orphaned mongod
  (leftover from an earlier session) holding the `data/mongo` lock while the
  `next start` under test could not start its embedded instance. Killed the
  orphan; health → 200, listing HTML → 24 `/produkt/…` links again.

### #28 — German copy and SEO ✅
- Seed adjectives are stems now (`hochwertig`, `leicht`, …) declined per gender —
  no more „hochwertigeer Schuh" / „leichtees Smartphone"; colors use Swiss
  „weiss"; stock copy is „Nur noch N Stück" (Swiss plural, `stockLabel` in
  `src/lib/stock.ts`).
- Product `<title>`/metadata use the real product name (DB lookup), not the
  de-slugged URL with index suffix; `src/lib/site.ts` is the single site-origin
  source (`SITE_URL`/`absoluteUrl`).
- JSON-LD: `@graph` with Product (absolute image URLs, `url`, offer `url`s) +
  `BreadcrumbList`; breadcrumbs render separator as a sibling `<li>` (no `<li>`
  nested in `<li>`).
- Unknown `/produkt/<slug>` answers a real HTTP 404 from the proxy (DECISIONS);
  page dropped its Suspense wrapper so `notFound()` still works.
- Verified: `tests/catalog-copy.test.ts` (5), proxy 404/passthrough tests in
  `tests/security-routes.test.ts`, e2e `tests/e2e/seo.spec.ts` (3: 404 status,
  real-name title, JSON-LD completeness) — fail on the pre-fix build; live check
  after `npm run seed -- --fresh`: health 200, listing 24 links,
  `/produkt/gibts-nicht` → 404, title „OnePlus OnePlus 13T | coder-shop",
  „leichtes Smartphone", absolute JSON-LD images + BreadcrumbList, 0× „weiß".
  `npm test` ✅ 280, lint/build ✅, e2e ✅ 21/21.

### #34 — dead code, unused route and create-next-app leftovers removed ✅
- `knip@6.41.0` exact-pinned as devDependency with `knip.json` (`npm run knip`) — reports
  nothing now. Removed: `netFromGross` (test-only VAT helper), `MOCK_TRACKING_PATTERN`
  (moved into `tests/shipping.test.ts`), the session.ts re-export barrel (tests import
  from `session-token` directly), the uncalled `POST /api/shipping/label/[orderId]`
  together with `src/server/same-origin.ts` (label creation is the Server Action only —
  Next enforces its same-origin check; ARCHITECTURE §4/§8 corrected), the 5 unused
  create-next-app SVGs in `public/`, and 11 fully unused types.
- ~40 exports used only inside their own file lost the `export` keyword (DECISIONS).
  Vendored `src/components/ui/**` is knip-ignored on purpose (canonical shadcn shape).
- Verified: `npx knip` exit 0; `npm test` ✅ 275 (removed the tautological
  net+vat test and the same-origin block with their code), lint/build ✅, e2e ✅ 21/21.

### #35 — docs match the code, naming deviations recorded/fixed ✅
- ARCHITECTURE §2 rewritten from `git ls-files` — now includes `src/proxy.ts`,
  `app/not-found.tsx`, `src/test/db.ts`, `checkout-claim` model, `order-access`,
  `secure-path`, `limiter`/`rate-limit`, the DTO/labels/sites/dates/collections libs,
  the new storefront/admin components and `knip.json`; lists nothing that doesn't
  exist. New §13 documents the knip rule.
- DECISIONS: the `no-img-element` justification now says generated photos (was
  "local SVGs"); `storefront/` (not `shop/`) recorded as a deliberate deviation;
  lib-purity rule recorded.
- `src/lib` is pure again (guard test `tests/lib-purity.test.ts`, 20 files):
  `ProductType` → `lib/product-types.ts`, `ProductFilter` → `lib/facets.ts`
  (replaces the duplicate `DerivedFilter`), DTO types → `lib/dto.ts`,
  `PurchaseOrderStatus` + `PO_STATUS_LABELS` → `lib/purchasing/labels.ts`;
  models/search re-export what their consumers already imported.
- DOM ids are English: `adresse|versand|zahlung` → `address|shipping|payment`,
  `ahnliche-heading` → `related-heading`; `src/test/smoke.test.ts` moved to
  `tests/` (test layout).
- Verified: new purity guard fails on the pre-fix imports; `npm run knip` ✅,
  `npm test` ✅ 303, lint/build ✅, e2e ✅ 21/21.

## ISSUES — queue session 4 (2026-10-17)

### #37 — product pages logged "unstable value new Date() while prerendering" ✅
- Root cause (found with `__NEXT_SHOW_IGNORE_LISTED=true` to unfilter the stack):
  the product page's `generateMetadata` queried MongoDB in the **prerender stage**
  (`await params` does not unwrap the request) — the driver's internal `new Date()`
  in `ConnectionCheckOutStartedEvent` (CMAP) tripped Next's guard on every view.
- Fix: `await connection()` before the lookup in `generateMetadata`
  (`src/app/(storefront)/products/[slug]/page.tsx`); rule recorded in DECISIONS.
  All other metadata functions either avoid the DB or sit behind `connection()`.
- Verified: new e2e `tests/e2e/server-log.spec.ts` — global setup now tees the
  production server's stdout/stderr to `tests/e2e/.server.log` (gitignored) and the
  spec visits three product pages, then requires the whole run's log to contain no
  prerender error — **fails on the pre-fix build**, green with the fix; live repro
  run (throw-away replica set + `next start`) logged the error twice before the fix
  and nothing after; `npm test` ✅ 303, lint/build ✅, `npm run test:e2e` ✅ 22/22.

### #38 — repeatable LAN run: setup:lan + .env.local ✅
- `npm run setup:lan` (`scripts/setup/setup-lan.ts` + pure `env-file.ts`): ensures
  `.env.local` (gitignored, chmod 600) has a generated `SESSION_SECRET` (≥ 32 chars)
  and `ADMIN_PASSWORD`, seeds the database with them and prints the start command and
  the admin login; re-runs keep existing values. `scripts/load-env.ts`
  (`process.loadEnvFile`, existing env wins) makes the tsx scripts (seed, images) read
  the same file `next start` loads natively — no dotenv, no secrets in git.
- Verified: `tests/setup-lan.test.ts` (4: parser, plan keep/generate, CLI run seeds an
  admin whose hash verifies against the printed password + mode 600, second run keeps
  secret/password/hash); live check of the issue scenario — production `next start`
  with **no** environment variables and only `.env.local`: health 200, `/admin` → 307
  `/admin/login` (was "Internal Server Error"), login page 200, no SESSION_SECRET
  error in the log; README "Run on the LAN" section; `npm test` ✅ 307, lint/knip/
  build ✅, e2e ✅ 22/22.

## ISSUES — queue session 5 (2026-10-17)

### #39 — customer portal: registration, login, my orders ✅
- Scoped sessions: `scope` in the token payload (`admin` | `customer`, missing = admin),
  separate cookies `admin_session`/`customer_session`, role-scoped login
  (`authenticate(email, password, role)`), `resolveSessionUserId(token, scope)` checks
  token scope + user role + revocation; the proxy guards `/konto/*` with a customer token
  (public: anmelden/registrieren/passwort-vergessen/passwort-zuruecksetzen) and no longer
  lets a customer token through the admin gate. Customer sessions last 30 days.
- Portal `/konto`: overview, **Bestellungen** (newest first, search by number/article,
  guest-order claim by e-mail, „Erneut bestellen" with today's prices/stock via
  `getReorderLinesCore`), **Adressen** (address book on the user document, one default per
  kind), **Profil** (data, password change, logout); login/register (strength hint +
  consent)/forgot/reset pages under `/konto/(auth)`.
- `registerCustomerCore` (rate-limited, welcome mail), password reset via hashed
  single-use one-hour tokens (`password_resets`, TTL) — constant answer, no enumeration;
  reset revokes all sessions. `claimOrderCore` links a guest order after the e-mail proof;
  checkout attaches `userId` from the session (never from the payload) and the
  idempotency fingerprint includes it.
- Order confirmation PII rule extracted to pure `canViewOrderDetails` — the owning
  account (linked or same e-mail) now sees the details it already knows.
- Mail foundation: `sendMail` → `mail_messages` dev outbox, German templates as pure
  functions (`src/lib/mail-templates.ts`), admin view `/admin/mails` (nav entry added).
  Full transport interface + remaining templates are #44.
- Verified: `tests/customer-portal.test.ts` (17: pure visibility, register incl.
  duplicate/weak/consent, customer-vs-admin login both ways + scope cross-checks +
  logout revocation, reset hash-only storage/single-use/expiry/no-enumeration, addresses
  default-exclusivity/edit/delete, claim wrong-e-mail/foreign-order, order list order +
  search); new e2e `customer-portal.spec.ts` (register → prefilled checkout → order →
  logout → login → order with status; reset link read from `/admin/mails` → new password
  logs in) — `npm test` ✅ 327, lint/knip/build ✅, `npm run test:e2e` ✅ 24/24.

## ISSUES — queue session 6 (2026-10-17)

### #40 — payment on invoice (Rechnung) with open invoices ✅
- Checkout: „Rechnung“ payment method for **registered customers** only — offered on
  `/kasse` when the account's credit is not exhausted, re-checked **inside the checkout
  transaction** (`assertInvoiceEligible`: account exists, open invoices + this total ≤
  `user.creditLimitCents`, default CHF 1'000.00); guest/over-limit orders fail with a
  German error and nothing is written. Invoice orders are created `new` (unpaid) with
  `payment.invoice` = due date (+30 d), `paidCents`, ISO-11649 QRR reference.
- State machine: payment-method-aware context — invoice-only `new → picking` (process
  before payment), `new → paid` only via `viaInvoicePayment`; `allowedTransitions` hides
  exactly those from the admin buttons (DECISIONS).
- Invoice PDF (`src/server/invoices-pdf.ts`): A4 with line items, totals, VAT note and a
  Swiss QR-bill section — real SPC payload + QR code (`qrcode@1.5.4`, exact-pinned),
  demo creditor (DECISIONS). Generated on demand into `data/invoices/`, served by
  `GET /admin/invoices/[orderId]` (admin session) and
  `/bestellung/[nummer]/rechnung` (order-visibility rule, #3).
- Portal `/konto/rechnungen`: open invoices with amount, due date, overdue marker, PDF
  link, settled history below. Admin `/admin/invoices`: filters offen/überfällig/bezahlt,
  partial payments (over-amount refused), reminder levels 1/2 (overdue-only, 2 after 1,
  once each, mail to the dev outbox), per-customer credit limits with usage.
- Verified: `src/lib/invoices.test.ts` (9: due date, open amount, overdue, mod-97/QRR
  validity + tamper rejection, 31-line SPC payload), `tests/invoices.test.ts` (11: guest
  refusal, unpaid order shape, process-unpaid-but-no-button-paid, credit limit across
  orders + after payment, partial→settle, admin/portal lists + overdue flag, reminder
  rules + outbox mail, PDF contains the reference, limit 0 blocks); new e2e
  `invoice-payment.spec.ts` (register → invoice checkout → confirmation + PDF → portal
  open → admin marks paid → both sides settled). `npm test` ✅ 350, lint/knip/build ✅,
  `npm run test:e2e` ✅ 25/25.

### #41 — payment on pickup (Bezahlung bei Abholung) ✅
- Checkout: Versand-Option „Abholung im Laden“ (gratis, `SHIPPING_CENTS.pickup = 0`,
  Store-Adresse + Öffnungszeiten aus `src/lib/store.ts`) und Zahlung „Bei Abholung“
  (nur mit Abholung, Schema-Refine; Rechnung+Abholung abgelehnt). Pickup-Bestellungen
  entstehen `new`/unbezahlt mit 6-stelligem Abholcode (eindeutiger Alphabet) auf
  `shipping.pickup`; Karte+Abholung zahlt sofort wie bisher.
- State machine: neue Status `ready` („Bereit zur Abholung“) und `picked_up`
  („Abgeholt“), nur mit `shippingMethod: "pickup"` im Kontext erreichbar; Pickup-
  Bestellungen bleiben aus der Paket-Kette ausgeschlossen (auch `packed → shipped`
  mit Etikett); `ready → picked_up` ist übergabe-only (wie Label-only #10); Cancel
  aus `ready` restockt; `PICKUP_PATH` (new → ready → picked_up) ersetzt die Kette auf
  der Bestätigungsseite.
- `src/server/pickup.ts`: `markPickupReadyCore` (new/picking → ready, Stempel),
  `handoverPickupCore` (Code-Prüfung, `ready → picked_up` + `payment.paidAt` +
  Bar/Karte in einer Transaktion, bedingter Write), `listPickupQueueCore`;
  Kommissionierungs-Queue schliesst Pickup aus; Dashboard: KPI „Abholungen bereit“,
  `picked_up` zählt zum Umsatz.
- Bestätigung: Abhol-Block mit Ladenadresse, Öffnungszeiten, Code + QR-Code
  (`qrcode`, nur für Berechtigte gerendert) und Statushinweis; Portal-
  Bestellungsliste zeigt den Code; Admin `/admin/pickup` (Bereitstellen,
  Code-Eingabe + Bar/Karte, Toasts), Navigation + Badge-Töne + Admin-Detail-Block.
- Verified: state-machine-Unit-Tests (Pickup-Kette, Button-Ausblendung, Restock),
  Schema-Tests (Kombinationsregeln), `tests/pickup.test.ts` (10: Code-Format,
  Unpaid-Erzeugung + Gratisversand, Kombi-Ablehnung, gesamter Queue-Flow inkl.
  falschem Code und Statusbutton-Sperre, direkt bereit aus `new`, Karten-Abholung
  ohne Doppelzahlung, Cancel restockt, Ketten-Trennung, Gast-Checkout); e2e
  `pickup.spec.ts` (Gast-Checkout → Code/QR → Bereitstellen → falscher Code →
  Übergabe mit Karte → „Abgeholt“ + bezahlt). `npm test` ✅ 368, lint/knip/build ✅,
  `npm run test:e2e` ✅ 26/26.

## ISSUES — queue session 7 (2026-10-17)

### Gate recovery (before the queue) ✅
- The #11 concurrency test flaked in the gate (`checkout 1: expected false to be true`):
  10 parallel transactions contend on the one Counter document and WiredTiger aborts all
  but one per conflict round — a single checkout can therefore lose up to n−1 rounds,
  more than the old 6-attempt budget covered. `runClaimedCheckout` now allows 16 attempts
  with backoff capped at 200 ms + wider jitter.
- The gate's e2e EADDRINUSE (and the 9 failures behind it) was a stale `next start` on
  port 3100 answering the health check — specs silently ran against the wrong server.
  The e2e global setup now refuses to start while the port is taken, with the kill hint.

### #42 — purchasing: keyboard-driven picker dialog ✅
- `src/components/admin/picker-dialog.tsx`: command-palette style Radix Dialog —
  type-to-search (200 ms debounce, stale results never flash), ↑/↓/Home/End through the
  listbox, Enter selects, Esc cancels, focus trapped inside and returned to the opener
  on close; combobox/listbox roles with `aria-activedescendant`, match highlighting,
  image + secondary + meta per row, „Suche…“/„Keine Treffer“/„mindestens 2 Zeichen“
  states. One implementation for every admin pick.
- PO form: supplier `Select` and the SKU dropdown replaced by two picker dialogs
  („Lieferant wählen“, „Artikel hinzufügen“) — a whole PO is creatable with the keyboard.
- Server (`src/server/purchasing.ts`): variant search now matches SKU **or name or
  brand** (SKU matches win when present), carries `imageSrc` and the **last purchase
  price** per SKU (newest PO line); new `searchSuppliers` (active only, lead time +
  open-PO count). Both behind zod-guarded actions (`searchSupplierAction` added).
- Verified: `tests/purchasing.test.ts` +2 (name/brand/SKU ranking, image, last price;
  supplier lead time/open POs/inactive hidden); new e2e `purchasing-picker.spec.ts` —
  Esc cancels + focus returns, Enter/↑/↓ select, qty typed, supplier swapped through
  the dialog, submit navigates to the PO detail — keyboard only; `npm test` ✅ 370,
  lint/knip/build ✅, `npm run test:e2e` ✅ 27/27.

### #44 — e-mails for every step, with a dev outbox ✅
- Transport behind an interface (`src/server/mail.ts`): `MailTransport` with the dev
  outbox (stored in `mail_messages`, readable under `/admin/mails` — unchanged default)
  and a nodemailer SMTP transport that takes over as soon as `SMTP_HOST` + `SMTP_FROM`
  are set (`SMTP_PORT` default 587, 465 ⇒ implicit TLS, optional user/password);
  pure `selectTransportName` covers the decision.
- New German templates (pure, `src/lib/mail-templates.ts`): order confirmation (number,
  amount, confirmation link), invoice (amount, due date, QR-PDF link), shipped
  (tracking number), pickup ready (store address, hours, handover code).
- Hooks, all after the successful commit and never failing the workflow (log only):
  checkout → confirmation (+ invoice mail for Rechnung orders), `createLabelCore` →
  tracking mail only on the fresh `packed → shipped` move (not on the idempotent
  repeat), `markPickupReadyCore` → ready mail with the code. Registration, password
  reset and reminders already sent mails (#39/#40).
- Verified: `tests/mails.test.ts` (8: template content incl. amounts via `formatChf`,
  tracking, code, store hours; transport selection; integration — checkout writes the
  confirmation to the outbox, Rechnung writes both, label writes exactly one tracking
  mail even on retry, pickup-ready writes the code). README env table + ARCHITECTURE
  updated; `npm test` ✅ 378, lint/knip/build ✅.
  (Follow-up: the outbox test sorts by insertion `_id`, not millisecond `sentAt` —
  two mails in the same millisecond sorted nondeterministically.)

### #43 — customer accounts in the admin ✅
- `src/server/customers-admin.ts`: `listCustomersCore` (search by name/e-mail, orders
  per account summed over linked **and** guest-by-e-mail orders, open invoice amount),
  `getCustomerDetailCore` (orders newest-first with ids, open invoices + total, credit
  limit, addresses, notes), `setCustomerBlockedCore` (block also revokes all sessions
  via #6's `sessionsInvalidBefore`), `setCustomerNotesCore`, `adminResetPasswordCore`
  (same hashed single-use token as self-service, mailed — the admin never sees a
  password). All customer-scoped writes refuse admin ids and junk.
- User model: `blocked` (login refuses with „gesperrt" **only after** the correct
  password — no enumeration oracle) and `notes` (≤ 2000 chars).
- UI: `/admin/customers` (search + table with blocked badge, order count, open amount),
  `/admin/customers/[id]` (orders, open invoices, credit + link to the invoice admin,
  address book, block/unblock, password reset, internal notes), nav entry „Kunden",
  and „Kundenkonto öffnen" on the order detail whenever the order is linked (#43's
  done-when).
- Verified: `tests/admin-customers.test.ts` (5: search + summed counts + open amount;
  detail order/open invoices/overdue + unknown/admin refused; block→login refused +
  sessions revoked + wrong-password stays generic→unblock works + admins untouchable;
  notes trim/limits; reset mail → token works once, then refused, new password logs
  in); `npm test` ✅ 383, lint/knip/build ✅.

## ISSUES — queue session 8 (2026-10-17)

### #45 — discount codes and promotions ✅
- Pure rules in `src/lib/discounts.ts` (`discountForSubtotal` — percent/fixed, minimum
  order, capped at the subtotal; `isDiscountInWindow` — active flag + from/to), money
  flows through `computeTotals(items, method, discountCents)`: the reduction lowers the
  taxable gross, VAT over the discounted total.
- Models `discount_codes` (unique upper-case code, limits, window, atomic `usedCount`)
  and `discount_usages` (`_id = code|customerKey` — unique index enforces once-per-
  customer, doubles as the usage statistic).
- `src/server/discounts.ts`: `checkDiscountCore` (window, minimum, limit, once-per-
  customer — no booking) and `redeemDiscount` **inside the checkout transaction**
  (conditional `$inc` + unique usage document; a race loser aborts the order, a failed
  order never burns a redemption). `createOrderCore` takes an optional `discountCode`
  (normalized, part of the #15 fingerprint), refuses a bad code as a clean user error
  with nothing written, and records `{ code, cents }` on the order.
- Storefront: `DiscountInput` with live server feedback in cart and checkout; the cart
  store persists the code (`cart:v1`) and the checkout re-validates it; the reduction
  shows in the summary, confirmation, admin order detail and the invoice PDF.
- Admin `/admin/discounts` („Aktionen" in the nav): create form (percent/fixed, CHF
  amounts, window, usage limit, once-per-customer), activate/deactivate, table with
  used/limit and distinct-customer counts.
- Verified: `tests/discounts.test.ts` (10: pure rounding/cap/minimum/window, VAT over
  the reduced gross, valid code on the order + `usedCount`, usage limit exhausted,
  once-per-customer (same e-mail refused, other e-mail works), expired window, minimum
  order, unknown code, refused code writes nothing, admin stats, bad create input,
  failed redemption releases the claim for a corrected resubmit); pricing test for the
  discount parameter. `npm test` ✅ 395, lint/knip/build ✅, `npm run test:e2e` ✅ 27/27.

## ISSUES — queue session 9 (2026-10-17)

### Gate recovery (before the queue) ✅
- The gate's e2e EADDRINUSE on port 3100 was again a stale process from an earlier
  session; it had exited on its own before this session started (port verified free,
  full e2e green). No code change — the #7-era guard in `global-setup.ts` refuses to
  start while the port is taken, which is exactly what fired.

### #46 — wishlist, recently viewed, back-in-stock alerts ✅
- **Wishlist**: heart on every product card and on the product page (disabled until
  the store hydrates, `aria-pressed`); `src/stores/wishlist.ts` — localStorage
  (`wishlist:v1`, newest-first, dedup, cap 100, corrupt-payload rejection). While a
  customer session exists the storefront layout renders `WishlistSync` (session check
  behind `connection()` + Suspense so the static shell survives): merge on mount =
  the login sync, replace on later changes, responses applied only while nothing
  changed locally meanwhile. Account copy: `user.wishlist` slugs, re-resolved against
  the products collection on every sync (unknown slugs dropped). Portal
  `/konto/wunschliste` (server-rendered, `WishlistMergeOnVisit` catches local items
  that have not merged yet, remove button updates account + local mirror).
- **Zuletzt angesehen**: `src/stores/recently-viewed.ts` (browser-local, cap 12) +
  `RecentlyViewedTracker` on the product page and `RecentlyViewedRail` on home and
  product pages (renders nothing without history); products come from the new
  `GET /api/recently-viewed?slugs=…` (≤ 12, requested order, unknown skipped).
- **Back-in-stock**: sold-out variant on the product page offers
  „Benachrichtigen, wenn wieder verfügbar“ (`RestockAlertForm`, guests included);
  `restock_alerts` documents keyed `sku|email` (idempotent subscribe), notified once
  per sell-out via `notifiedAt` — hooked into goods receipt and cancel-restock, mail
  through the #44 transport, never fails the workflow.
- Verified: `src/stores/wishlist.test.ts` (serialize/deserialize/sanitize/toggle/cap),
  `tests/wishlist.test.ts` (merge keeps local order + drops unknown slugs, replace is
  the truth, cap, remove, non-customer refused, portal list order),
  `tests/restock-alerts.test.ts` (subscribe idempotent + unknown sku + already-in-stock,
  notify only in-stock skus, once per alert, mail in the outbox, receipt + cancel
  restock trigger it); new e2e `wishlist.spec.ts` (heart on card → rail → logout/login
  keeps the wishlist in the portal; sold-out variant → subscribe → outbox entry) —
  `npm test` ✅ 413, lint/build ✅, `npm run test:e2e` ✅ 29/29.

### #47 — product reviews and ratings ✅
- Pure rules `src/lib/reviews.ts`: statuses + labels, `countsAsPurchase` (every order
  status except `new`/`cancelled`), `aggregateRating` (one-decimal average, star
  distribution, junk values ignored).
- Model `reviews`: one per (product, buyer) via unique `{ productId, userId }`,
  `rating 1–5`, `status pending|approved|hidden`, optional title and `adminReply`;
  only buyers of the product may submit (server-checked against their orders), new
  reviews start `pending`.
- `src/server/reviews.ts`: `submitReviewCore` (purchase check, authorName copy,
  duplicate → clean error), `getProductReviewsCore` (approved, newest first +
  aggregate), `hasPurchasedCore`/`getUserReviewCore` for the form gate, admin
  `listReviewsCore`/`setReviewStatusCore`/`replyToReviewCore`; the approved aggregate
  is denormalized to `product.rating` on every moderation change (DECISIONS).
- Storefront: `ReviewSection` on the product page (average, distribution bars,
  reviews with „Verifizierter Kauf" badge and the shop's answer; form only for
  logged-in buyers who have not reviewed yet), `StarRating` on product cards once
  rated, listing sort „Beste Bewertungen" (`sort=rating`, unrated last), JSON-LD
  `AggregateRating`.
- Admin `/admin/reviews` („Bewertungen" in the nav): status tabs, per-review
  Freigeben/Verstecken and the answer field.
- Verified: `src/lib/reviews.test.ts` (4), `tests/reviews.test.ts` (7: buyer-only +
  pending start, cancelled/new prove nothing, one per buyer, approval publishes with
  the right average + denormalized product rating, hide removes from both, answer
  stored, junk ids clean); new e2e `reviews.spec.ts` (register → buy → 5 stars →
  pending invisible → admin approves + answers → published with badge/average/
  AggregateRating, no second form; non-buyer sees no form) — `npm test` ✅ 425,
  lint/build ✅, `npm run test:e2e` ✅ 31/31.

## ISSUES — queue session 11 (2026-10-17)

### #60 — password forms: input kept after errors, rules shown live ✅
- Root cause of the cleared registration: React resets **uncontrolled** form fields
  after a form action completes — name/e-mail/consent were uncontrolled (only the
  password was controlled). Every field in the four password-setting forms
  (registration, password reset, portal and admin password change) is now controlled,
  so a failed submit keeps everything the user typed — the password included.
- One pure rule source `src/lib/password-rules.ts` (customer: 10 chars + letter +
  digit; admin: length) — `validateCustomerPassword`, the admin action schema and the
  new shared `PasswordRulesChecklist` all read it, so client and server enforce exactly
  the same rules; the checklist is `aria-live` (each rule announced „erfüllt / noch
  nicht erfüllt" + overall state) and the submit button is disabled until every rule
  of the scope is met.
- Errors now sit at the field they belong to: actions return `fieldErrors`
  (`fieldErrorsFrom` over the zod issues; `changePasswordCore` gained a `reason` so
  „aktuelles Passwort falsch" lands on the current-password field), inputs get
  `aria-invalid` + `aria-describedby`.
- Verified: `src/lib/password-rules.test.ts` (3); new e2e `password-forms.spec.ts`
  (4: live checklist + gated submit on registration; failed registration keeps
  name/e-mail/password and shows the error at the name field; reset form checklist;
  admin form keeps all three values with the error at the current field) — the
  keep-input assertions fail on the pre-fix build (reproduced: name/e-mail came back
  empty); `npm test` ✅ 442, lint/build ✅, `npm run test:e2e` ✅ 43/43.

### #59 — calm, stable layout: no jumping on navigation, nothing overlapping ✅
- Page jump: `RouteTransition` no longer slides the whole page (`y: 8` → 0) on every
  pathname change — a calm opacity-only fade (150 ms); `html` gets
  `scrollbar-gutter: stable` so navigating between pages of different heights cannot
  shift content horizontally when the vertical scrollbar appears/disappears.
- Toast overlap: the Toaster moved from `bottom-right` to `bottom-center` — it sat on
  the cart drawer's and the cart summary's „Zur Kasse“; adding to the cart fires no
  toast at all anymore (the drawer opening + animated badge is the feedback per §8),
  so nothing floats over the drawer while it is open.
- Verified: new e2e `tests/e2e/layout-stability.spec.ts` (4: sampled the transition
  wrapper's computed transform through two real navigations — never non-identity,
  header box identical before/after; `scrollbar-gutter` is `stable`; add-to-cart opens
  the drawer with zero toasts and an unobstructed, hittable „Zur Kasse“; a login-error
  toast's box never intersects the submit or the header cart button) — the transform
  and no-toast assertions fail on the pre-fix build; `npm test` ✅ 438, lint/build ✅,
  `npm run test:e2e` ✅ 39/39.

## ISSUES — queue session 10 (2026-10-17)

### Gate recovery (before the queue) ✅
- The gate's 14 uncommitted files were the finished but uncommitted #48 comparison
  work (store, lib, tray/toggle, page, rewrite, tests, docs). Verified as-is
  (lint/knip/build/test/e2e all green after two knip `export` removals:
  `subscribeCompare`, and pre-existing `recomputeProductRatingCore` from #47),
  committed and pushed as the #48 fix.

### #48 — compare smartphones side by side ✅
- `src/stores/compare.ts`: up to 4 smartphone slugs, localStorage (`compare:v1`,
  dedup, cap, corrupt-payload rejection), hydrate-after-mount via the shared
  `LocalStoreHydrator`; `CompareToggle` (Scale icon, `aria-pressed`) on smartphone
  cards and the product page next to the wishlist heart; floating `CompareTray`
  ("N im Vergleich", Vergleichen disabled below 2, clear button).
- `/produkte/vergleichen?slugs=…` (rewrite before the product-slug rule): server
  page resolving the slugs (`getProductsBySlugs`, non-smartphones and unknown
  dropped, ≤ 4 kept), table of Preis/Marke/Speicheroptionen/Farben/Gewicht/
  Varianten/Verfügbar from pure `buildComparisonRows` (`src/lib/compare.ts`);
  differing rows tinted + sr-only "(Unterschied)"; horizontal scroll + sticky
  feature column on mobile; < 2 phones → German hint, no slugs → 404.
- Verified: `src/lib/compare.test.ts` (5: comparable filter/cap, row values,
  difference detection, price "ab" + weight range formats), `src/stores/compare.test.ts`
  (4: round-trip, corrupt rejection, toggle/cap/dedup, hydrate); new e2e
  `compare.spec.ts` (4 distinct-brand phones toggled → tray → table with highlighted
  Marke row → clear; single slug → hint) — `npm test` ✅ 432, lint/knip/build ✅,
  `npm run test:e2e` ✅ 33/33.

### #49 — admin command palette and keyboard shortcuts ✅
- `AdminCommandPalette` (panel layout): **⌘K / Ctrl+K** anywhere opens the #42
  picker dialog (`minChars=1`) — local hits (all ADMIN_NAV pages, „Neue
  Einkaufsbestellung") match instantly, entity hits come from
  `commandSearchCore` (`src/server/command-palette.ts`): orders by number or
  customer name/e-mail, products by name/brand/SKU, customers (never admins),
  suppliers → `?edit=`; ≤ 5 per group, results are plain links, Enter navigates.
  **`?`** (outside form fields) opens a shortcuts overlay (⌘K, ?, ↑/↓, Enter, Esc);
  the sidebar footer shows both hints (discoverability).
- Picker fix found by the e2e: content now unmounts when `open` goes false — a
  quick reopen during Radix's exit animation used to carry the old query over.
- Verified: `tests/command-palette.test.ts` (6: order by number/customer, product
  by name/brand/SKU, customer-not-admin, supplier edit link, empty + cap); new e2e
  `command-palette.spec.ts` (Ctrl+K → order number → detail; → product → edit page;
  local action hit; `?` overlay + "?" typed in the field stays a character) —
  `npm test` ✅ 438, lint/knip/build ✅, `npm run test:e2e` ✅ 35/35.

## ISSUES — queue session 12 (2026-10-17)

### Gate recovery (before the queue) ✅
- The gate's `/api/health` 500 and link-less `/produkte` were again an orphaned
  `next-server` + its mongod holding the `data/mongo` lock; killed, nothing left
  running. The 64 uncommitted files were the finished #61 work — delivered below.

### #61 — agnostic catalog: types, attributes and filters as data ✅
- **`product_type_configs`** (`src/models/product-type-config.ts`) is the single source
  for product types: key/label/position, variant `dimensions` (key/label/facet/order/unit),
  `stockTracking` (quantity | serial — the #62 hook), `comparable` (replaces the
  `type === "smartphone"` checks in card/detail compare toggles), `photoNoun` (image
  prompt subject — the review's last hard-coded type map, `VIEW_NOUNS` deleted) and
  `brands`. `DEFAULT_CATALOG_TYPES` (`src/lib/catalog-types.ts`) is only its seed
  content; `getCatalogTypes`/`getCatalogType`/`saveCatalogTypeCore` (validated) in
  `src/server/catalog-types.ts` are the only access.
- **Generic catalog code:** `Product.attributes`/`filter` are Mixed keyed by dimension
  (`deriveFilter(variants, dimensions)` orders values per the dimension's `order` rule);
  `parseListingParams(searchParams, types)` accepts only the selected type's facet
  dimensions; listing sidebar, `$facet` counts, menu/tabs/footer chips, home tiles,
  breadcrumbs, JSON-LD category and the admin type filter all read the configs
  (`menuCategories(types)`); `lib/brands.ts` retired. Write path: `updateProductCore`
  refuses unknown types, `updateVariantCore` refuses attributes outside the type's
  dimensions; the seed upserts configs insert-only (#14) and `repairProductFilters`
  migrates documents from the old `filter.colors/sizes/…` shape.
- Verified: `tests/catalog-types.test.ts` — a fourth type ("Zubehör" with
  compatibility/length dimensions) created at runtime works end to end without a code
  change: menu, listing params + facet counts, product DTO, checkout order, admin list +
  variant validation, config edit survives re-seed; new e2e `catalog-types.spec.ts`
  covers the per-category facet columns (smartphones no longer offer size/material —
  the #53 part). `npm run build`/lint/knip ✅, `npm test` ✅ 453,
  `npm run test:e2e` ✅ 47/47.
- Open: the #56 remainder (VAT/shipping/payment methods as configuration, admin editor
  for the type configs) is split to **#64**.

## ISSUES — queue session 13 (2026-10-17)

### #64 — VAT, shipping prices and payment methods as data; catalog-type editor ✅
- **`shop_settings`** (one document, `src/models/shop-settings.ts`) is the single source
  for the commerce rules: `vatRatePercent`, `freeShippingFromCents`, shipping methods
  (key/label/priceCents/position/active/storePickup/hint) and payment methods
  (key/label/position/active/`kind: immediate | invoice | on_pickup`).
  `DEFAULT_SHOP_SETTINGS` (`src/lib/shop-settings.ts`, pure) is only its seed content;
  `getShopSettings`/`saveShopSettingsCore` (validated — key format/uniqueness, price
  bounds, never the last active shipping/payment method) in `src/server/shop-settings.ts`
  are the only access; the seed inserts insert-only (#14).
- **Generic readers:** `pricing.ts` takes the settings (`computeTotals`, `shippingCents`,
  `freeShippingProgress`, `vatFromGross(gross, rate)`, `vatLabel`/`vatInclusiveNote`);
  checkout validates method keys against the active rows and stores the flow on the order
  (`shipping.storePickup`, `payment.kind`); the state machine switched from method-name
  literals to behavior flags (`storePickup`, `processBeforePayment`, `payAtHandover` via
  `flowFlagsFor`) — a new immediate payment or parcel shipping method needs no code
  change; invoices/pickup/orders-admin/labels read the rows (retired method → stored key).
  Storefront clients get the settings through `ShopSettingsProvider`
  (`GET /api/shop-settings`, `public, max-age=60` — DECISIONS); server components read
  `getShopSettings()` directly (`VatLabel` in a dynamic hole, #37 rule).
- **Admin editors:** `/admin/settings` (VAT, free-shipping, shipping + payment method
  rows) and `/admin/catalog-types` (+ `[key]` editor for label, position, photoNoun,
  stockTracking, comparable, brands, dimensions) behind `saveShopSettingsAction` /
  `saveCatalogTypeAction` → the validated cores; nav entries „Einstellungen" and
  „Katalogtypen".
- **Seed fix (review note from #61):** `seedCatalogTypes`/`seedShopSettings` now return
  the **stored** rows, so `repairProductFilters` and the seeded order totals derive from
  the configuration an admin may have changed, not from the defaults.
- Verified: `src/lib/shop-settings.test.ts` + `tests/shop-settings.test.ts` (VAT/shipping
  change flows through `createOrderCore` totals, runtime-added method end to end,
  validation refusals, seed insert-only + returns stored settings); `tests/catalog-types.
  test.ts` extended (re-seed hands out stored dimensions); new e2e `settings.spec.ts`
  (admin edits VAT + standard price → footer/cart follow without a code change; catalog
  type rename → mega-menu follows; both restore the shared server in `finally` — a
  midway failure can no longer poison later specs; the CHF regexes match the NBSP
  `formatChf` renders, and the restore check disables the browser HTTP cache via
  routing). `npm run build`/lint/knip ✅, `npm test` ✅ 472, `npm run test:e2e` ✅ 49/49.

## ISSUES — queue session 14 (2026-10-18)

### #63 — Everything in code is English: routes and URLs too ✅
- **Routes are English:** the storefront route folders are renamed to their English names
  (`account/` with `(auth)/login|register|forgot-password|reset-password` and
  `(portal)/orders|invoices|wishlist|addresses|profile`, `orders/[number]` +
  `orders/[number]/invoice`, `products/compare`) — the former German URLs were only rewrites
  over English folders plus `konto/…`; now URL and route are identical, no indirection.
- **Old URLs redirect permanently:** `rewrites` in `next.config.ts` became `redirects()` with
  `permanent: true` (308) for every former German URL (`/produkte`, `/produkte/vergleichen`,
  `/produkt/:slug`, `/warenkorb`, `/kasse`, `/bestellung/:number[/rechnung]`, `/konto/…`);
  the mapping stays configuration, not code. Redirects run before the proxy, so guarded
  areas never see the old paths.
- **Proxy:** gate and slug-404 checks now match `/account/*` and `/products/*`
  (`/products` and `/products/compare` are routes, not slugs); matcher updated.
- **Links/redirects/tests:** every internal link, redirect target and metadata URL in
  components, pages, actions and mails is English; new e2e `english-urls.spec.ts` asserts
  each old URL answers 308 to its exact English counterpart (query preserved) and that
  `/products` answers 200 directly while `/account` gates guests to `/account/login`;
  the specs that still asserted `/bestellung/…` / `/produkt/…` URLs updated.
- **DECISIONS:** the superseded "German public URLs via rewrites" decision is marked as
  such and a #63 entry records the rename, the 308-as-configuration choice and the
  proxy-gate move (reopened finding).
- Verified: `npm run build`/lint ✅, `npm test` ✅ 474, `npm run test:e2e` ✅ 51/51.

## ISSUES — queue session 15 (2026-10-18)

### #63 (reopened) — DECISIONS entry for the English-URL decision ✅
- The implementation was verified at e8de0b6; the reopened finding was documentation:
  DECISIONS still recorded "German public URLs via rewrites" as current. That entry is
  now marked superseded and a #63 entry documents the rename, the 308-as-configuration
  choice and the proxy-gate move; the #48 entry's URL updated. Docs-only commit.

### #62 — serial-number stock for smartphones, incoming stock visible ✅
- **Part B (#55) incoming stock:** PO `expectedArrivalAt` set from the supplier lead time
  on `markPurchaseOrderOrderedCore` (`expectedArrival` pure) and editable per PO
  (`setExpectedArrivalCore` + form); partial goods receipt (`receivePurchaseOrderCore(poId,
  quantities, …)` — per-line received qty, PO stays `ordered` until complete);
  `getIncomingBySkuCore` derives per-SKU open qty + earliest arrival from the `ordered` PO
  lines (never stored on the product); pure `src/lib/purchasing/incoming.ts` holds the
  aggregation and the German bucket copy ("5 Stk. bestellt, Ankunft ca. in 3 Tagen");
  shown on the product page + variant picker for low/zero-stock variants (sold-out ones
  marked), in the admin variant editor ("N bestellt") and on the PO list/detail.
- **Part A (#54) serial stock:** smartphones' type config is `stockTracking: "serial"`;
  new `stock_units` ledger (`src/models/stock-unit.ts`, serial unique per SKU, status
  chain `in_stock → reserved → packed → shipped → sold`, cancel releases — pure chain in
  `src/lib/stock-units.ts`, all data access in `src/server/stock-units.ts`). Goods
  receipt registers each piece by serial (typed/scanned, duplicates refused in batch and
  against the ledger); checkout reserves exact units inside its transaction and records
  the serials on the order line; units travel with `transitionOrderCore`/label/handover
  and a restocking cancel releases them; serials print on packing slip + invoice PDF.
  `updateVariantCore` refuses direct stock edits on serial types (stock = unit count).
  Admin: `/admin/stock-units` ledger (search by serial/SKU, per-unit history, nav entry)
  + "Serien ansehen" link per variant. Seed: serial smartphone stock (0–8/variant) and
  `seedStockUnits` (one unit per in-stock piece, idempotent).
- **Fixes along the way:** duplicate-serial lookup after the aborted transaction reads
  outside the session (Mongo aborts the txn on the duplicate write); e2e cart helpers
  (`addSellableVariantToCart` in `tests/e2e/helpers.ts`) now pick a variant that actually
  has stock via the API and click its label parts — the old "first button of each group"
  hit sold-out serial variants; `purchasing.spec.ts` types serials at receipt;
  `incoming-stock.spec.ts` runs on a quantity-tracked shoe (stock edits on serial types
  are refused by design).
- Verified: new `tests/stock-units.test.ts` (11: pure unit chain + receipt/units/stock
  count, duplicate refusal both ways, exact reservation, travel to sold, cancel release,
  serial→PO→order trace, legacy-stock refusal writes nothing, unit race);
  `tests/purchasing.test.ts` +ETA/partial/serial tests; new e2e `serial-stock.spec.ts`
  (buy → reserved unit → slip serial → ship → delivered → "Verkauft" with history) and
  reworked `incoming-stock.spec.ts` — both fail on the pre-#62 build.
  `npm run build`/lint/knip ✅, `npm test` ✅ 495, `npm run test:e2e` ✅ 53/53.

## ISSUES — queue session 16 (2026-10-18)

### Gate recovery (before the queue) ✅
- The gate's `/api/health` 500 and link-less `/produkte` were again an orphaned
  `next-server` (spinning at 100 % CPU) plus its mongod holding the `data/mongo`
  lock; both killed, nothing left running. The 48 uncommitted files were the
  finished #62 work and `a8b465f` the unpushed #63 DECISIONS entry — both delivered
  below after re-running the full gate on this tree.

### #63 (second reopen) — DECISIONS wording, then pushed ✅
- The reopened finding was two wording points in the #63 DECISIONS entry: the
  missing note that **#58 prefixes the language in front of the English paths**
  (`/fr/account/profile` — the path stays English in every language), and an
  overstated e2e claim. The entry now says what `english-urls.spec.ts` actually
  asserts: every former German URL answers `308` with its exact English target in
  `Location` (query preserved, redirects not followed), `200` checked directly on
  `/products`, guest `/account` a `307` to `/account/login`. Docs-only, staged as
  the #63 hunk alone so the #62 DECISIONS hunk stayed for its own commit.
- Verified: `git push` (with `a8b465f`) closed #63; issue state `CLOSED`.

### #62 — serial-number stock and derived incoming stock ✅
- The whole implementation was finished and gate-recorded in queue session 15 but
  never committed. Re-verified on this tree before committing: lint, knip, build,
  `npm test` ✅ 495 and `npm run test:e2e` ✅ 53/53 (throw-away replica set, port
  3100 verified free first) — including the new `tests/stock-units.test.ts` (11),
  the incoming-stock pure tests and the `serial-stock`/`incoming-stock` e2e specs,
  all of which fail on the pre-#62 build.
- Design as built (DECISIONS): `stock_units` is the ledger for types whose config
  says `stockTracking: "serial"`, `variant.stock` stays the derived count;
  reservation lives inside the checkout transaction and units travel with the order;
  incoming stock is derived per SKU from `ordered` PO lines, never stored twice.
- Verified: committed as one commit (`fixes #62`) and pushed; issue state `CLOSED`,
  tree clean.

### #58 — translation foundation (step 1 of 5) ✅ — issue stays open
- **`languages` + `translations` are the two new configuration collections** (§3):
  a language is a row (`code`, `label`, `intlLocale`, `position`, `active`; seed de,
  fr, it, rm, es with `de-CH|fr-CH|it-CH|rm-CH|es`), a text is a row with the
  required German `de` base and a `texts` map keyed by language code — a new
  language is a new map key plus a row, never a schema or code change.
- **Pure layer `src/lib/i18n.ts`:** `resolveLanguage` (URL prefix → remembered
  cookie → `Accept-Language` with q-values and region stripped → first active
  language; values outside the active set never answer), `textFor`/`isTranslated`
  (missing or blank falls back to German) and `createTranslator`, whose
  `missingKeys()` report is the test hook and the future admin missing-view source.
- **`src/server/i18n.ts` is the only access:** rows are process-cached and every
  write (`saveTranslationCore`, `saveLanguageCore`) invalidates the cache, so an
  edit is live on the next request without a deploy; both cores validate
  (key shape, area enum, non-empty German, texts only for known language codes).
  Seed `seedLanguages`/`seedTranslations` are insert-only (#14).
- Verified: `src/lib/i18n.test.ts` (10: precedence incl. deactivated/unknown
  values, Accept-Language q-order and dedup, fallback, missing report, the five
  languages with Swiss locales) and `tests/i18n.test.ts` (4: insert-only seed
  survives an edit, cache serves until a write invalidates it, defaults while
  empty, validation refusals write nothing, a new language added as a row works
  end to end) — both fail without the change. `npm run build`/lint/knip ✅,
  `npm test` ✅ 513, `npm run test:e2e` ✅ 53/53.
- **Left open (steps 2–5):** language-prefix routing + switcher + hreflang,
  extracting every remaining UI/mail/PDF string into rows, translatable catalog
  content with admin editing, the admin translation editor with history, and the
  two-language checkout e2e.

## ISSUES — queue session 17 (2026-10-18)

### Gate recovery (before the queue) ✅
- The gate's `/api/health` 500 and the MongoMemoryServer `DBPathInUse` errors were again
  an orphaned mongod holding the `data/mongo` lock; killed. The gate's `/produkte → 308`
  and "no `/produkt/…` links" are the intended #63 behaviour (former German URLs answer a
  permanent 308 to their English counterpart, and product links are now `/products/…`) —
  verified live: `/produkte` → 308 → `/products`, `/products` 200 with 24 product links,
  `/api/health` 200. Server + mongod stopped again.

### #62 (reopened) — serials on the label, PO trace in the ledger, atomic markOrdered ✅
- **Serials on the label data** (issue text: "serial on packing slip, label data and
  invoice" — only the label was missing): `LabelRequest.serials` (`src/lib/shipping/types.ts`),
  filled in `createLabelCore` from `order.lines[].serials`; one pure source for the block,
  `labelSerialLines` (`src/lib/shipping/label-content.ts`); the mock label renders it and the
  UPS provider sends it as `Shipment.ShipperReferences` (`Tag: "SERIAL"`, ≤ 35 chars —
  DECISIONS). Quantity orders carry none.
- **Serial → purchase-order trace in the admin UI** (done-when: "trace any serial to its
  purchase order"): `searchStockUnits` batch-resolves the units' `purchaseOrderId`s to their
  `poNumber` (`StockUnitListItem.purchaseOrderNumber`); `/admin/stock-units` renders a link
  to `/admin/purchasing/<id>` with the `E-…` number instead of the static "· aus
  Wareneingang"; the goods-receipt history note now names the PO (`Wareneingang E-…`).
- **Atomic `markPurchaseOrderOrderedCore`** (regression from #62): restored the conditional
  `findOneAndUpdate({ _id, status: "draft" })` after computing the ETA — two concurrent
  "Bestellen" clicks can no longer both move the PO (same discipline as `transitionOrderCore`).
- **Seed:** the `ordered` sample PO now carries one serial-tracked line (chosen by the type
  configs' `stockTracking`, not a hard-coded type) so the receipt + ledger trace is
  demonstrable end to end.
- Verified: `tests/shipping.test.ts` +4 (pure `labelSerialLines`; mock renders the block;
  UPS `ShipperReferences` present for serials / absent for quantity; `createLabelCore` passes
  the order's serials to the provider and none for quantity); `tests/stock-units.test.ts`
  trace test extended (`searchStockUnits` returns `purchaseOrderNumber` + the receipt note
  names the PO); `tests/purchasing.test.ts` +1 (two concurrent orderings → exactly one wins);
  e2e `purchasing.spec.ts` asserts the ledger shows the received serial's PO number linking to
  the PO detail with the `Wareneingang E-…` note — all fail on the pre-fix build.
  `npm run build`/lint/knip ✅, `npm test` ✅ 520, `npm run test:e2e` ✅ 53/53.

### #58 (step 4 slice) — admin translation + language editor ✅ — issue stays open
- **`/admin/translations`** — the one translation table as an editable list: free-text
  search over key/German/every language + area filter (`filterTranslations`, pure), a
  column per active language with a visible amber „fehlt" marker where a text falls back
  to German, capped at 200 rows with a narrow-the-search hint. `/admin/translations/[key]`
  edits one row (key fixed, area select, required German base, one input per language —
  blank = missing); `/admin/translations/neu` adds a key.
- **`/admin/translations/languages`** — the language rows as forms: code (fixed once
  created), label, intlLocale, position, `active`. A new language is a form, not a deploy
  (the #58 done-when, operable); rows deactivate instead of delete so their texts survive.
- **Writes go through the existing validated cores** (`saveTranslationCore`/
  `saveLanguageCore`) behind two zod-guarded admin actions (`saveTranslationAction`/
  `saveLanguageAction`) — no new write path, cache invalidated on every save, nav entry
  „Übersetzungen".
- Verified: `src/lib/i18n.test.ts` +3 (`filterTranslations` text/area/combined);
  `tests/i18n.test.ts` +3 (action round-trip: save → translator answers it; junk key /
  missing German / unknown language code refused with nothing written; a new language row
  via the action); new e2e `translations.spec.ts` (edit a French text → reload shows it;
  new key with the „fehlt" marker; add Portuguese) — fails on the pre-fix build.
  `npm run build`/lint/knip ✅, `npm test` ✅ 526, `npm run test:e2e` ✅ 54/54.
- **Left open:** step 2 language-prefix routing + switcher + hreflang (design decided:
  `app/[lang]/…` nesting per the Next 16 i18n guide — a proxy rewrite would make the root
  layout dynamic and kill the PPR shell), step 3 extracting every remaining UI/mail/PDF
  string into rows (the missing-key check fails on untranslated keys), step 4 remainder
  (translation history), step 5 translatable catalog content + two-language checkout e2e.

### #58 (review fix) — a translation save no longer destroys deactivated languages ✅ — issue stays open
- **Bug:** editing any row deleted the texts of deactivated languages — the editor
  rendered only active languages, submitted only those codes, and `saveTranslationCore`
  `$set` the whole `texts` map, contradicting the deactivate-not-delete decision.
- **Fix:** the editor page passes `getLanguages()` (every row, inactive marked
  „(deaktiviert)"), `handleSubmit` sends every rendered code with its raw value
  (blank = „clear"), and the core updates `texts` **per code** — non-blank `$set`,
  blank `$unset`, absent untouched; unknown codes still refused. A partial payload is
  safe by construction for the editor and any future caller.
- Verified: `tests/i18n.test.ts` regression (fr survives an old-style payload without
  fr; explicit `fr: ""` clears only fr, it untouched — first assertion fails on the
  pre-fix build); e2e `translations.spec.ts` extension (deactivate fr → edit the German
  base → reactivate → the French text is listed again).
  `npm run build`/lint/knip ✅, `npm test` ✅ 538, `npm run test:e2e` ✅ 55/55.
- **Left open (corrected record):** step 2 language-prefix routing + switcher +
  hreflang; step 3 string extraction + no-German-literals guard; step 4 remainder —
  missing-translations filter, needs-review filter, usage context + preview link,
  keyboard-driven inline editing, change history; step 5 translatable catalog content
  + two-language checkout e2e.

## ISSUES — queue session 18 (2026-10-18)

### Gate report findings — no defect ✅
- The gate's `GET /produkte → HTTP 308` and „the HTML links to no product page
  (/produkt/…)" are the intended #63 behaviour (former German URLs answer a permanent
  308 to their English counterpart; product links are `/products/…`). Re-verified live:
  `/produkte` → 308 → `/products`, product links present, health 200.

### #58 (step 2 slice) — language-prefix routing, switcher and hreflang ✅ — issue stays open
- **Every storefront route moved under `app/[lang]`** (`git mv`, one pass): URLs become
  `/de/products`, `/fr/account/profile` — the path itself stays English in every language
  (#63). Two root layouts replace the single one: `app/[lang]/layout.tsx` (storefront:
  `<html lang>` from the segment, `generateStaticParams` from the seeded language codes so
  the PPR shells stay prerendered, per-language Open Graph locale) and `app/admin/layout.tsx`
  (prefix-free, `<html lang="de">`, noindex — the admin switcher waits for step 3's
  strings). Shared pieces: `app/fonts.ts`, `app/site-metadata.ts`,
  `components/not-found-content.tsx` (per-root 404 boundaries + the global `/_not-found`
  page the proxy's real-404 rewrite answers, #28).
- **Proxy (`src/proxy.ts`):** resolves the language for every storefront request
  (prefix > `lang` cookie > `Accept-Language` > first active row — the pure
  `resolveLanguage`), 307-redirects prefix-free paths to `/{lang}{path}` with the query
  preserved, refreshes the `lang` cookie on prefixed requests (choice remembered), and
  runs its gates (admin, account, product-slug 404) on the **stripped** path; login
  redirects get the prefix back. Public files (paths with an extension) pass through —
  this also fixes a live regression from #63: generated photos share the `/products/`
  prefix with product pages and the old slug check would have answered 404 for them.
  Matcher: everything except `_next/`, `api/` and dotted paths.
- **Pure `src/lib/locale-path.ts`:** `splitLanguagePrefix`/`localizedPath` + the
  `x-localized-path` header name — the proxy, the switcher and the metadata all derive
  their URLs from it with the language codes passed in as data.
- **Switcher + hreflang:** `LanguageSwitcher` in the header (one link per active language
  row to the same page in that language, query preserved, `aria-current`, iterates the
  `languages` rows); hreflang alternates + `x-default` + per-language canonical from
  `generateMetadata`, fed by the proxy's `x-localized-path` request header behind
  `connection()` (#37 rule; a client-component variant was tried and rejected — its links
  only reach the flight payload, not the crawler-visible HTML).
- **Listing shell** state changes now `router.replace` on the current (prefixed) pathname
  instead of the hard-coded `/products` — no redirect hop per filter change.
- Verified: `src/lib/locale-path.test.ts` (7); `tests/security-routes.test.ts` rewritten
  for the prefixed paths + new language-routing block (307 with query, Accept-Language,
  cookie beats browser, unknown segment, cookie write, admin prefix-free, account gate
  behind the prefix, photo passthrough, matcher exclusions); new e2e
  `language-routing.spec.ts` (5: browser language → `/fr` + `<html lang="fr">`, hreflang
  set + x-default, switcher keeps page/query/choice, all five languages serve the listing,
  real 404 behind the prefix); `english-urls.spec.ts` updated (prefix-free `/products` is
  the 307 to `/de/products` now; `/de/products` answers 200 directly) — all fail on the
  pre-change build. Live: `/de/products` 200 with 6 hreflang links, `/produkte` → 308 →
  `/products` → 307 → `/de/products`, unknown product 404 with the German 404 UI.
  `npm run build`/lint/knip ✅, `npm test` ✅ 555, `npm run test:e2e` ✅ 60/60.
- **Left open:** step 2b locale-parameterized formats (`format.ts` locale from the
  language row); step 3 string extraction + no-German-literals guard + translated
  metadata; step 4 remainder (missing/needs-review filters, usage context + preview,
  keyboard inline editing, history); step 5 translatable catalog content + two-language
  checkout e2e; admin language switcher.

## ISSUES — queue session 19 (2026-10-18)

### Gate report + switcher flake (before the queue) ✅
- The gate's `GET / → 307`, `GET /produkte → 308` and „no `/produkt/…` links" are the
  intended #63/#58-step-2 behaviour, re-verified live: `/` → 307 → `/de`, `/produkte`
  → 308 → `/products` → 307 → `/de/products` (200, product links present), health 200.
- **Switcher flake quantified and fixed** (review session finding): the switcher spec
  failed 9/10 repeated runs. Two stacked root causes, both real product bugs:
  1. `LanguageSwitcher` used `Link` — a client-side navigation can be answered from the
     router's prefetch cache without any request, so the proxy never ran and the
     remembered-choice cookie stayed stale. Switcher links are now real anchors: the
     proxy (the cookie's only writer) is guaranteed to see the switch.
  2. The proxy refreshed the `lang` cookie on **every** prefixed request — including
     background RSC prefetches of the page's links. A stale `/de/…` prefetch response
     landing after the `/fr/…` navigation overwrote the fresh choice (visible in the
     Playwright trace: `Set-Cookie: lang=fr`, then late prefetch responses with
     `Set-Cookie: lang=de`). The cookie is now written on document navigations only
     (`Accept: text/html`).
- Verified: new proxy test (RSC prefetch leaves the cookie untouched — fails on the
  pre-fix proxy; the remembers-test now sends a document `Accept`); the whole
  `language-routing.spec.ts` × 5 repeats → 25/25 (was 9/10 failures on the switcher
  test alone); `npm run build`/lint/knip ✅, `npm test` ✅ 556,
  `npm run test:e2e` ✅ 60/60.

### #58 (step 4 slice) — missing-translations filter ✅ — issue stays open
- `filterTranslations` gained `missingFor`: only rows without a text in that language
  remain (German as base is never missing); it combines with the text search and the
  area filter. `/admin/translations` shows a „Fehlt in:" select built from the active
  language rows (a new language appears in it without a code change); junk or
  deactivated codes fall back to the unfiltered list.
- Verified: `src/lib/i18n.test.ts` +1 (per-language missing sets, de base, combinations
  — fails without the filter); e2e `translations.spec.ts` +1 (a row translated in
  Italian only is listed under „Fehlt in: Français" while the fully translated seeded
  row is not; under Italian nothing remains; `?missing=xx` is ignored) — fails on the
  pre-fix build, where the parameter was ignored.
  `npm run build`/lint/knip ✅, `npm test` ✅ 557, `npm run test:e2e` ✅ 61/61.
- **Left open (#58):** step 2b locale-parameterized formats; step 3 string extraction
  + no-German-literals guard + translated metadata; step 4 remainder (needs-review
  filter, usage context + preview link, keyboard-driven inline editing, change
  history); step 5 translatable catalog content + two-language checkout e2e; admin
  language switcher.

## ISSUES — queue session 20 (2026-10-18)

### Gate report findings — no defect, re-verified ✅
- `GET / → 307`, `GET /produkte → 308` and „no `/produkt/…` links" are the intended
  #63/#58-step-2 behaviour, re-verified live against a fresh seed: `/` → 307 → `/de`,
  `/produkte` → 308 → `/products` → 307 → `/de/products` (200, product links present),
  health 200. The gate's German-URL expectations predate #63 (English public URLs).

### #58 (review follow-ups) — stale cookie sentence, exported BASE_LANGUAGE ✅
- DECISIONS #58 step 2 now says the proxy refreshes the `lang` cookie on prefixed
  **document navigations** only (matches the switcher-flake fix).
- `BASE_LANGUAGE` is exported from `src/lib/i18n.ts`; the literal `"de"` in the
  translation editor, the translations list, the `[lang]` metadata fallback, the admin
  root layout and the mail layout now reads it. Sort collations (`localeCompare(…,
  "de")`) stay — they are a collation locale, not the base-language code.

### #58 (step 2b slice) — formats follow the language row ✅ — issue stays open
- **`createFormatters(intlLocale)`** in `src/lib/format.ts`: one cached `Intl` set per
  locale (CHF, long date, date+time, weight, plain number); the named exports stay the
  base-locale formatters of the German-based admin/mails/invoices (until step 3).
  `intlLocaleOf` (pure, `lib/i18n.ts`) + `getIntlLocale` (server) resolve the locale
  from the language rows — a new language brings its formats with no code change.
- **Storefront:** client components (product card incl. rating, product detail, cart
  drawer/page, checkout, discount, search, free-shipping) read the formatters from the
  new `LocaleFormattersProvider` (seed-config initial value, `LocaleSync` dynamic hole
  syncs the live row); server pieces (order confirmation, account orders/invoices,
  review dates, status chain, comparison rows) take `intlLocale` from `params.lang`.
  The comparison page's own `toLocaleString("de-CH")` and raw gram strings are gone.
- Verified: `format.test.ts` +4 (per-locale CHF placement/separators, month names in
  fr/it/rm/es/de, weight + number separators, cache identity — fail without the
  factory), `i18n.test.ts` +4 (`intlLocaleOf` row/deactivated/unknown/empty),
  `compare.test.ts` adapted; new e2e `locale-formats.spec.ts` (2: de lists „CHF …",
  fr/es list „… CHF"; same product same amount both languages — fails on the
  pre-change build where every language rendered de-CH).
  `npm run build`/lint/knip ✅, `npm test` ✅ 565, `npm run test:e2e` ✅ 63/63.
- **Left open (#58):** step 3 string extraction + no-German-literals guard + translated
  metadata; step 4 remainder (needs-review filter, usage context + preview link,
  keyboard-driven inline editing, change history); step 5 translatable catalog content
  + two-language checkout e2e; admin language switcher.

### #58 (step 3 slice) — chrome texts come from the translation table ✅ — issue stays open
- **Label plumbing:** `labelMap`/`label`/`interpolate` (pure, `lib/i18n.ts`),
  `getLabels(lang)` (server) — the whole table resolved to the request language as one
  serializable key→text map; `HeaderSlot`/`FooterSlot` hand it to the client chrome as
  a prop (DECISIONS: a client translator context fed by an API was rejected — first-paint
  flash). Unknown keys answer themselves (visibly missing).
- **Extracted (seeded in all five languages):** header nav/account aria labels and the
  footer (tagline with `{vat}` placeholder, assortment, service, shipping, payment,
  returns, copyright with `{year}` rendered around it).
- Verified: `i18n.test.ts` +4 (labelMap language + German fallback, key-as-missing
  label, placeholder fill/keep, and the seed check — every `DEFAULT_TRANSLATIONS` key
  translated in every `DEFAULT_LANGUAGES` language, fails on an untranslated key);
  new e2e `chrome-translations.spec.ts` (3: de base, fr and es chrome — fails on the
  pre-change build where the chrome was hard-coded German).
  `npm run build`/lint/knip ✅, `npm test` ✅ 569, `npm run test:e2e` ✅ 66/66.
- **Left open (#58):** step 3 remainder — extract the remaining storefront/admin/mail/
  invoice strings + no-German-literals guard + translated metadata; step 4 remainder
  (needs-review filter, usage context + preview link, keyboard-driven inline editing,
  change history); step 5 translatable catalog content + two-language checkout e2e;
  admin language switcher.
### #58 (step 3 slice) — page metadata follows the translation table ✅ — issue stays open
- `generateMetadata` of the listing, cart, checkout, comparison and order-confirmation
  pages now reads `getLabels(lang)` behind `connection()`: titles and descriptions are
  table texts, `{vat}`/`{number}` interpolated. The #63 rename had mechanically turned
  the German comparison title into „Produkte compare" — the table restores
  „Produkte vergleichen". All ten metadata keys seeded in all five languages (the seed
  test covers them).
- Verified: e2e `chrome-translations.spec.ts` +1 (fr listing title/description, es cart
  title, it compare title — fails on the pre-change build); `npm run build`/lint/knip ✅,
  `npm test` ✅ 569, `npm run test:e2e` ✅ 67/67.
- **Left open (#58):** step 3 remainder (remaining storefront/admin/mail/invoice body
  strings + no-German-literals guard), step 4 remainder, step 5, admin switcher.

## ISSUES — queue session 21 (2026-10-18)

### Gate report findings — no defect, re-verified ✅
- `GET / → 307`, `GET /produkte → 308` and „no `/produkt/…` links" are the intended
  #63/#58-step-2 behaviour, re-verified live against a fresh seed: `/` → 307 → `/de`,
  `/produkte` → 308 → `/products` → 307 → `/de/products` (200, 24 product links on the
  English `/products/<slug>` paths), health 200. Server + mongod stopped again.

### #58 (review fixes + step 3 slice) — cart flow texts + the four review findings ✅ — issue stays open
- **Review fixes (from the review of 8d6ab34/1130315):** `StarRating` and the
  `ReviewSection` average no longer call `toLocaleString("de-CH")` — the star is a
  client component reading `useFormatters().number` (its context default keeps the
  admin `/admin/reviews` usage on the base locale), the section formats with the
  request language's `createFormatters`; the `[lang]` layout's Open Graph fallback is
  `intlLocaleOf(DEFAULT_LANGUAGES, BASE_LANGUAGE)` instead of the literal `"de-CH"`;
  the pinned `"schaner"` in `format.test.ts` became an equality check against
  `new Intl.DateTimeFormat("rm-CH", …)` computed in the test (locale-driven, no ICU
  vocabulary pinned); the order-confirmation `generateMetadata` got the `connection()`
  guard the other four metadata functions have (#37 rule).
- **Cart flow into the table (area `shop`, 13 new keys seeded in all five languages —
  the seed test enforces):** empty page/drawer texts, „Weiter einkaufen", summary,
  subtotal, „Zur Kasse", the remove/decrease/increase aria labels (`{name}`), the
  free-shipping sentence (`{amount}` interpolated **already formatted**, so value and
  locale stay in one place) with its unlocked variant and progress aria-label, and the
  discount field label. Plumbing is the established prop pattern: the storefront layout
  hands the drawer its labels in a new `CartDrawerSlot` (dynamic hole, fallback null —
  the closed drawer occupies no space, the static shell survives), the cart page passes
  them to `CartPageView`, the checkout page through `CheckoutForm` to `DiscountInput`.
- Verified: new `star-rating.test.tsx` (2 via `renderToString`: es writes „4,5", de
  „4.5", provider-less admin stays base — **fails on the pre-fix component**,
  reproduced); new e2e `cart-translations.spec.ts` (3: empty fr cart page, filled fr
  cart page with „Retirer :" present and „Entfernen:" absent + „Code promo" + French
  free-shipping sentence, fr drawer) — fails on the pre-change build where all of it
  was hard-coded German; the changed format test and the seed-translation test cover
  fixes 2–3. `npm run build`/lint/knip ✅, `npm test` ✅ 571,
  `npm run test:e2e` ✅ 70/70.
- **Left open (#58):** step 3 remainder (checkout body, product page + review strings,
  account/auth forms, listing/filter, admin strings + admin language switcher,
  mail/invoice/slip/label texts in the recipient's language, no-German-literals guard),
  step 4 remainder, step 5, admin switcher.

### #58 (review fixes) — hermetic cart e2e + the untranslated header/cart labels ✅ — issue stays open
- **e2e hermeticity (the review's blocker):** `cart-translations.spec.ts` `seedCart`
  assumed the seeded line stays under the free-shipping threshold — after earlier specs
  consumed stock the first in-stock product could exceed it and the locked-sentence
  assertion timed out (69/70 at HEAD). It now reads `freeShippingFromCents` from
  `/api/shop-settings` and picks, cheapest-first, a variant with stock whose unit price
  is below the threshold — the locked bar renders deterministically regardless of what
  earlier specs consumed; the threshold stays data, never a hard-coded price.
- **Untranslated labels into the table (9 keys, seeded in all five languages):** the cart
  page's empty-state subtitle, `Maximal {max} an Lager` and the summary footnote
  (`{shipping}`/`{amount}`/`{vat}` interpolated already formatted), and the three header
  control labels the step-3 chrome pass missed — cart button `Warenkorb, {count}
  Artikel`, theme toggle, and the instant search (field label, placeholder, results
  aria-label, „Keine Treffer für «{term}»"). `Header` hands its existing label map to
  `CartButton`/`ThemeToggle`/`SearchInstant` (the established prop pattern).
- **Language-independent drawer test:** `CartButton` gained `data-testid="cart-button"`
  (same convention as `compare-tray`); the drawer spec clicks it instead of the German
  „Warenkorb" name and asserts the French cart/search labels are present and the German
  ones absent on `/fr`.
- Verified: two consecutive full `npm run test:e2e` runs 70/70 (the failure was
  stock-state dependent — a single run proves nothing); on the stashed pre-change build
  the updated spec fails 2/3 (German subtitle, missing testid/French header labels),
  reproduced; seed-translation test covers the 9 new keys × 5 languages. Gate report
  `/ → 307`, `/produkte → 308` re-confirmed as the intended #63/#58 behaviour (asserted
  by the green `language-routing`/`english-urls` specs). `npm run build`/lint/knip ✅,
  `npm test` ✅ 571, `npm run test:e2e` ✅ 70/70; tree clean, nothing running.
- **Left open (#58):** unchanged — step 3 remainder (checkout body, product page +
  review strings incl. the `ab` price prefix, listing/filter strings such as the sort
  select's „Sortierung", account/auth forms, admin strings + admin language switcher,
  mail/invoice/slip/label texts in the recipient's language, no-German-literals guard),
  step 4 remainder, step 5, admin switcher.

## ISSUES — queue session 22 (2026-10-18)

### Gate report findings — no defect, re-verified ✅
- `GET / → 307`, `GET /produkte → 308` and „no `/produkt/…` links" are the intended
  #63/#58-step-2 behaviour (English URLs, 308 for the former German ones, 307 onto the
  language prefix, product links `/products/…`), asserted by the green
  `language-routing`/`english-urls` specs; the review session re-verified the gate at
  HEAD. No code change.

### #58 (step 3 slice) — the checkout body reads its texts from the translation table ✅ — issue stays open
- **36 new keys (area `shop`, seeded in all five languages — the seed test enforces):**
  guest banner (question, „Anmelden"/„Konto erstellen"/„oder"/guest hint), empty state
  („Es gibt nichts zu bezahlen", reusing `shop.cart.emptyDrawer` +
  `shop.action.continueShopping`), the three step legends, the six customer field
  labels, „Gratis", the payment hints per configured `kind` (`{days}` from
  `INVOICE_DUE_DAYS`), the invoice card sentence with `{days}` + `{link}` and its own
  link-text key, the pickup note, the demo notice + the four card fields, the summary
  („Bestellübersicht", „Rabatt", „Versand", „Gesamt", reusing `shop.cart.subtotal`),
  the VAT note as `{vat} inbegriffen` (interpolated with the German `vatLabel` value —
  renders exactly the old `vatInclusiveNote` output; the lib function stays for
  server/invoice use), submit „Jetzt kaufen"/„Bestellen" (the „ — {amount}" joiner
  stays around the already-formatted value), AGB note and the success toast with
  `{number}`. The h1 reuses `shop.meta.checkout.title` (de base already „Kasse").
  **Every German base is byte-identical to the literal it replaced**, so the German
  specs that select „Kasse", `/Jetzt kaufen/` and `/8,1 % MwSt\. inbegriffen/` stay
  green untouched.
- **New pure helper `splitOnPlaceholder(text, name)`** (`lib/i18n.ts`): the invoice
  sentence embeds a `<Link>`; the translator places `{link}` wherever the language's
  word order needs it, the component renders before + link + after.
- `CUSTOMER_FIELDS` labels became `labelKey`s resolved at render (placeholders stay —
  sample values, not UI copy); `paymentHint` takes the labels map. No German UI
  literal is left in the checkout page or form. Shipping/payment method labels and
  hints stay `shop_settings` rows (configuration content is its own step); server-side
  zod error messages stay German (recorded — server-messages slice).
- **Review nit bundled:** `cart-translations.spec.ts` now asserts the **French theme
  label present** („Activer le thème clair ou sombre"), not just the German one absent.
- **e2e:** the hermetic `seedCart` moved from `cart-translations.spec.ts` into
  `tests/e2e/helpers.ts` (shared, threshold still read from `/api/shop-settings`);
  new `checkout-translations.spec.ts` (2: fr checkout — h1 „Caisse", guest banner,
  legends via `#shipping`/`#payment`, field labels „Nom, prénom"/„NPA", summary,
  submit „Acheter maintenant — … CHF", German „Jetzt kaufen"/„Bestellübersicht"/
  „Zahlung" absent; es checkout — „Caja", „Resumen del pedido", „Comprar ahora").
- Verified: both specs **fail on the pre-change build** (reproduced against a stashed
  rebuild); `splitOnPlaceholder` unit tests (3) fail without the helper; seed-translation
  test covers the 36 keys × 5 languages. `npm run build`/lint/knip ✅,
  `npm test` ✅ 574, `npm run test:e2e` ✅ 72/72; tree clean, nothing running.
- **Left open (#58):** step 3 remainder (product page + review strings incl. the „ab"
   price prefix, listing/filter strings such as the sort select's „Sortierung",
   account/auth forms, admin strings + admin language switcher, mail/invoice/slip/label
   texts in the recipient's language, server-side validation messages,
   no-German-literals guard), step 4 remainder (needs-review filter, usage context +
   preview link, keyboard-driven inline editing, change history), step 5 (translatable
   catalog content + two-language checkout e2e).

## ISSUES — queue session 23 (2026-10-18)

### Gate report findings — no defect, re-verified ✅
- `GET / → 307`, `GET /produkte → 308` and „no `/produkt/…` links" are the intended
  #63/#58-step-2 behaviour (English URLs, 308 for the former German ones, 307 onto the
  language prefix, product links `/products/…`), asserted by the green
  `language-routing`/`english-urls` specs in every gate run. No code change.

### #58 (step 3 slice) — the browse flow reads its texts from the translation table ✅ — issue stays open
- **~70 new keys (area `shop`, seeded in all five languages — the seed test enforces):**
  product cards („Beliebt", „Ausverkauft", the „ab" price prefix), the product page
  (VAT note, incoming-stock sentence + arrival buckets, qty aria labels,
  „Bitte {options} wählen", variant line, breadcrumbs „Start", accordion, related
  rail, „Zuletzt angesehen"), the gallery (arrows + thumb aria), the stock indicator
  (all three levels — `stockLabel` left `lib/stock`), reviews (heading, counts,
  distribution aria, empty/verified/reply/pending/done/buyers-only notes, the whole
  form), restock alerts (title, submit, aria, subscribed note, three toasts), the
  listing (heading fallback, „Alle", collection chip + remove, result counts, Filter,
  sort select + four options, empty state, pagination) and the skip link. Every German
  base is byte-identical to the literal it replaced, so the German specs
  („Alle Produkte", „In den Warenkorb", „Nächstes Bild", „Sofort lieferbar",
  „N Stk. bestellt, Ankunft ca. …", „Bitte … wählen", …) stayed green untouched.
- **`LabelsProvider`/`LabelsSync`/`useLabels` (DECISIONS):** the seed-config label map
  of the URL's language initialises the context (static shell, no hydration flicker),
  a dynamic hole syncs the live table — deep client trees (cards on five pages, rails,
  the listing shell) read texts without prop-drilling. `arrivalBucket`/`incomingLabel`
  now take the label map (the libs keep the computation, the copy is data).
- **e2e:** new `product-translations.spec.ts` (3: fr listing — h1, sort options,
  „Filtres"/„Marque", „dès" prefix, „Affichage 1–24 sur …"/„Suivant", skip link; fr
  product page — „Accueil", „Veuillez choisir …" → „Ajouter au panier", VAT note,
  gallery/accordion/„Avis"/„Produits similaires"; es listing + product page) — all
  three **fail on the pre-change build** (reproduced against a stashed rebuild).
  `npm run build`/lint/knip ✅, `npm test` ✅ 575, `npm run test:e2e` ✅ 75/75.
- **Left open (#58):** step 3 remainder (home page hero/collections, account/auth
  forms, admin strings + admin language switcher, mail/invoice/slip/label texts in the
  recipient's language, server-side validation messages, no-German-literals guard),
  step 4 remainder (needs-review filter, usage context + preview link, keyboard-driven
  inline editing, change history), step 5 (translatable catalog content + two-language
  checkout e2e).

## ISSUES — queue session 24 (2026-10-18)

### #58 (review-fix slice) — plural mechanism, checkout legend nit, card toggles/tray into the table ✅ — issue stays open
- **`plural(labels, count, key, intlLocale)` (DECISIONS):** the CLDR category of the
  count in the language row's Intl locale picks the suffixed row (`key.one`,
  `key.other`, …), falling back to `key.other` — a language with `two`/`few`/`many`
  is served by adding rows, never code. Replaces the `count === 1` branches
  (listing shell, reviews) and the fr „pièce(s)" hack; `useIntlLocale()` exposes the
  live locale to client call sites without a prop. Unit tests: de 0→other/1→one,
  **fr 0→one** (the exact CLDR fix), `.other` fallback, `ar` few/many rows resolved
  from data.
- **Count keys became families** (German bases byte-identical): `shop.listing.count.*`,
  `shop.reviews.count.*`, `shop.stock.low.*` (fr splits into „pièce"/„pièces").
  **Legend nit done:** `shop.checkout.shipping` → `shop.checkout.legend.shipping` +
  `shop.checkout.summary.shipping`. The seed gains `retireTranslations` — a fixed
  migration deleting exactly the six replaced rows (DECISIONS; insert-only #14
  otherwise keeps them as dead data), covered by a DB test.
- **Card toggles + tray (12 new keys, five languages):** compare-toggle (incl. the
  English `${name} compare` #63 artifact replaced by real German „{name} vergleichen"),
  wishlist-heart and compare-tray now read `useLabels()` + `interpolate`; title and
  aria-label share the keys. German bases byte-identical, so the wishlist/compare/
  a11y specs stayed green untouched.
- **Tests:** +5 unit (plural ×4, retire ×1) — `npm test` ✅ 580; new e2e „card toggles
  and the comparison tray speak French" + the compare spec's artifact selector —
  **2 fail on the pre-change build** (reproduced against a stashed rebuild).
  `npm run build`/lint/knip ✅, `npm run test:e2e` ✅ 76/76; tree clean, nothing running.
- **Left open (#58):** step 3 remainder (home page hero/collections, account/auth
  forms, admin strings + admin language switcher, mail/invoice/slip/label texts in the
  recipient's language, server-side validation messages, no-German-literals guard),
  step 4 remainder (needs-review filter, usage context + preview link, keyboard-driven
  inline editing, change history), step 5 (translatable catalog content + two-language
  checkout e2e).

## ISSUES — queue session 25 (2026-10-18)

### #58 (step 3 slice) — home hero/collections and the whole account area read the table ✅ — issue stays open
- **Home page:** hero title/subtitle/CTA, category tiles, collection headings and the
  per-collection blurbs (~`shop.home.blurb.<collection>`) moved into the table; the
  hero renders through a new `HeroSlot` behind `connection()` (labels + shop settings,
  `{vat}` interpolated) with a transparent `HeroSkeleton`, so the static shell keeps
  prerendering. Categories/Collections/FeaturedRail take `lang` + `getLabels`.
- **Auth pages** (login, register, forgot/reset password): static `metadata` →
  `generateMetadata` behind `connection()`, headings/hints via `getLabels(lang)`,
  `instant = false`; the password-rule texts left `lib/password-rules.ts` (the rule
  keeps key + test only) and live as `shop.password.rule.*` with `{min}` — the
  checklist reads them through `useLabels()`.
- **Portal:** layout, overview (order count via `plural` + `intlLocale`), orders,
  invoices, wishlist, addresses, profile and the claim form converted; client forms
  (login, register, password reset/change, address book, reorder, wishlist remove,
  logout) read `useLabels()`. `vat-label.tsx` became unused and was deleted.
  German bases byte-identical throughout, so every existing German spec passes
  untouched.
- **Registration rate limit is configuration (DECISIONS):** the suite registers one
  account per authenticated spec from one IP and had exhausted the hard-coded 5/h
  window exactly — the new portal spec made the 6th and throttled `wishlist.spec`.
  `CUSTOMER_REGISTER_LIMIT_PER_HOUR` (default 5, production unchanged) now feeds
  `createRateLimiter`; the e2e global setup sets 60 for its own server.
  `order-privacy.spec` now asserts real PII („Lena Meier") instead of the UI word
  „Lieferadresse", which the seed label map legitimately ships on every page.
- **Tests:** new e2e `account-translations.spec.ts` (fr hero, fr login+register,
  fr portal overview/orders/profile, es login+reset). `npm test` ✅ 580,
  `npm run build`/lint/knip ✅, `npm run test:e2e` ✅ 80/80; tree clean, nothing running.
- **Left open (#58):** step 3 remainder (admin strings + admin language switcher,
  mail/invoice/slip/label texts in the recipient's language, server-side validation
  messages, no-German-literals guard), step 4 remainder (needs-review filter, usage
  context + preview link, keyboard-driven inline editing, change history), step 5
  (translatable catalog content + two-language checkout e2e).

### #58 slice — account metadata language, account plural families, reset-limit config ✅ (2026-10-18)

- **Account layout metadata:** `account/layout.tsx` static German `metadata` →
  `generateMetadata` behind `connection()` reading `shop.meta.account.title`/
  `.description` (new rows, five languages, German base byte-identical) — the portal
  overview inherits them, so /fr/account no longer ships a German tab/OG title;
  the auth/portal subpages keep their own metadata.
- **Plural families:** `shop.account.orders.items`, `shop.account.reorder.added` and
  `shop.account.reorder.skipped` became `.one`/`.other` families (de identical, real
  singulars in fr/it/rm/es); the bare old keys joined `RETIRED_TRANSLATION_KEYS`
  (insert-only seed migration). Consumers switched to `plural(...)`: the orders page
  (already loads `getIntlLocale`) and `ReorderButton` via `useIntlLocale()`.
- **Reset limit is configuration:** `CUSTOMER_RESET_LIMIT_PER_HOUR` (default 3,
  production unchanged) feeds `resetRequestLimit` like its register sibling;
  README + ARCHITECTURE env notes updated.
- **Tests:** unit — fr-CH `plural` resolves `{count} article`/`articles` and the
  reorder toasts follow their families (fail without the rows), plus a guard that no
  retired key ships as a live row; e2e — `account-translations.spec.ts` registers a
  French customer, buys through the French checkout and asserts "1 commande dans votre
  compte.", the French `<title>`, "1 article" (never "1 articles") on the orders page,
  then a second purchase (qty 2 — the idempotent checkout #15 answers a byte-identical
  resubmit with the same order) and "2 commandes". Fails on the pre-change build
  (German title, single-row plurals) — reproduced. `seedCart` gained an optional
  `qty` (matching stock filter) for repeat purchases.
- **Gate:** `npm run build`/lint/knip ✅, `npm test` ✅ 583, `npm run test:e2e` ✅ 81/81;
  tree clean, nothing running.
- **Left open (#58):** unchanged from the previous slice (admin strings + switcher,
  mail/invoice/slip/label texts, server-side validation messages, no-German-literals
  guard; step 4 remainder; step 5).

### #58 slice — the order confirmation flow reads its texts from the table ✅ (2026-10-18)

- **Confirmation page** (`orders/[number]/page.tsx`): every literal became a row —
  `shop.order.thanks`/`heading`/`tracking`/`parcelWeight`, the invoice card
  (`invoice.title/.due/.open/.paid/.pdf` — the due line renders its monospace QR
  reference through `splitOnPlaceholder`), the pickup card (`pickup.*` incl.
  `payment.cash/.card` keyed by the payment type), totals (`shop.order.discount`
  with `{code}`, reused `shop.cart.subtotal`/`shop.checkout.total`/`.free`/`.vatNote`
  — `vatInclusiveNote` stays for the invoice PDF until the mails/PDFs slice),
  addresses/contact/`placedAt`. German bases byte-identical, so storefront,
  invoice-payment, admin-shipping, pickup and order-privacy specs pass untouched.
- **Status labels:** new `shop.status.<status>` rows for all nine state-machine
  statuses (keys derived from the statuses); `OrderStatusBadge` gained an optional
  `labels` prop (admin renders `STATUS_LABELS` unchanged — DECISIONS), the
  confirmation and the portal orders list pass theirs. `OrderStatusChain` takes
  `labels`: step names, cancelled banner and the „Bestellstatus" aria come from
  the table. `OrderAccessForm` reads `useLabels()`; its PII sentence embeds the
  styled order number at the row's `{number}`.
- **Per-language breadcrumbs and JSON-LD:** `Breadcrumbs` takes an `ariaLabel`
  (`shop.breadcrumbs.aria`), `JsonLd` a `homeLabel` (`shop.breadcrumbs.start`) —
  the BreadcrumbList now matches the visible, localized breadcrumbs.
- **Tests:** the seed test covers every new key × five languages; new e2e
  `confirmation-translations.spec.ts` completes a checkout on /fr (French thanks,
  heading, chain + „Payée", „Total", „Adresse de livraison", payment reference;
  unambiguous German absent) and shows a stranger the French access form — this
  delivers step 5's completed two-language checkout (de: storefront.spec). Both
  specs fail on the pre-change build (reproduced in a worktree at 20160a2).
- **Gate:** `npm run build`/lint/knip ✅, `npm test` ✅ 583, `npm run test:e2e` ✅
  83/83; tree clean, nothing running.
- **Left open (#58), corrected record:** step 3 remainder — the `[lang]` not-found
  page title (static German `metadata`; the page already resolves the language, so
  the account-layout `generateMetadata` pattern applies), admin strings + admin
  language switcher, mail/invoice/slip/label texts in the recipient's language,
  server-side validation messages, no-German-literals guard; step 4 remainder
  (needs-review filter, usage context + preview link, keyboard-driven inline
  editing, change history); step 5 remainder: translatable catalog content + admin
  editing + five-language demo content (the two-language completed checkout e2e
  landed with this slice).

## ISSUES — queue session 26 (2026-10-18)

### Gate report findings — no defect, re-verified ✅
- `GET / → 307`, `GET /produkte → 308` and „no `/produkt/…` links" are the intended
  #63/#58-step-2 behaviour (English URLs, 308 for the former German ones, 307 onto the
  language prefix, product links `/products/…`), asserted by the green
  `language-routing`/`english-urls` specs in every gate run. No code change.

### #58 (step 3 slice) — customer-facing validation and action messages read the table ✅ — issue stays open
- **The two bound machine-translation fixes** (review of e1828d2): `shop.order.invoice.open`
  it „Aperto" → „Resto: {amount}" (and the same-flawed rm „Avert" → „Restant"), and
  `shop.breadcrumbs.aria` es „Navegación de ruta de navegación" → „Miga de pan". Because
  the seed is insert-only, `TRANSLATION_TEXT_REPAIRS` + the seed's
  `repairTranslationTexts` step update exactly the rows still holding the flawed text —
  an admin edit is never overwritten (DECISIONS).
- **Schema factories:** `createCheckoutSchema`/`createRegister(Schema)`/
  `createCustomerLoginSchema`/`createPasswordReset(Request|Confirm)Schema`/
  `createAddressSchema`/`createAddressIdSchema`/`createClaimOrderSchema` and
  `validateCustomerPassword(password, labels)` take the label map; every German base is
  byte-identical to the literal it replaced, so the German checkout/account/password
  specs stayed green untouched. `checkout-form.tsx` validates client-side with the same
  rows (`useMemo` over the page's labels); `objectIdSchema` stays the German admin
  boundary (the customer path uses the localized `addressId` factory).
- **Request language for actions:** `getRequestLanguage()`/`getRequestLabels()`
  (`server/i18n`) — `lang` cookie > `Accept-Language` > first active row (the proxy's
  pure `resolveLanguage` reused), first active language outside a request scope. Wired
  into `createOrderCore`, the customer cores, the discount check/redemption, the order
  access core and the checkout/account/discount/review/order-access actions; the
  checkout rate-limit sentence interpolates `{seconds}`, the discount refusals
  `{amount}` (four new `shop.discount.*` rows), the access mismatch/throttle answers
  come from `shop.order.access*` rows.
- **Not-found:** `app/[lang]/not-found.tsx` static German `metadata` →
  `generateMetadata` behind `connection()` reading the new `shop.meta.notFound.title`/
  `.description` rows — `/fr/orders/<unknown>` now ships „Page introuvable | coder-shop"
  with the per-language canonical. The global `/_not-found` (the proxy's real-404
  rewrite target, prefix-free) stays German by design.
- **Checkout ceiling is configuration (DECISIONS):** the suite legitimately completes
  more checkouts from its one IP than the hard-coded 10/10 min allowed once this spec
  arrived — `CHECKOUT_LIMIT_PER_10_MIN` (default 10, production unchanged) now feeds
  the checkout action's limiter and the e2e global setup raises it, like its register
  sibling. README + ARCHITECTURE updated.
- **Tests:** `tests/validation-messages.test.ts` (5: German bases byte-identical,
  French messages through the factories, `{max}` interpolation),
  `tests/request-language.test.ts` (6: cookie wins, q-values, unknown values fall
  through, deactivated never answers, no-request fallback), `tests/i18n.test.ts` +1
  (seed repair fixes the three flawed texts, is idempotent, skips an admin edit);
  new e2e `validation-translations.spec.ts` (4: fr checkout empty submit → French
  field errors, refused discount in French, stranger's wrong e-mail refused in French,
  localized 404 title) — **all four fail on the pre-change build** (reproduced against
  a stashed rebuild: 4 failed).
- **Gate:** `npm run build`/lint/knip ✅, `npm test` ✅ 595, `npm run test:e2e` ✅
  87/87; tree clean, nothing running.
- **Left open (#58):** step 3 remainder — admin strings + admin language switcher
  (incl. the `OrderStatusBadge` move out of `components/admin/`, review nit),
  mail/invoice/slip/label texts in the recipient's language, the remaining core error
  texts (register duplicate/reset/claim/address, checkout method refusals), the
  untranslated cart bits („Entfernen"/„Einlösen"), no-German-literals guard; step 4
  remainder (needs-review filter, usage context + preview link, keyboard-driven inline
  editing, change history); step 5 remainder: translatable catalog content + admin
  editing + five-language demo content.

## ISSUES — queue session 27 (2026-10-18)

### Gate report finding — the global 404 answered German on French URLs ✅ fixed
- **Reproduced** `validation-translations.spec.ts` "unmatched URLs and unknown products
  answer the global 404 in French" against a fresh `next start`: the request reached the
  page in German. Two root causes: (1) a proxy **rewrite re-enters the proxy**, so the
  prefix-free rewrite target `/_not-found` hit the language logic and was 307-redirected
  to `/de/_not-found` — visible URL, base language, and the `x-language` header never
  arrived; (2) `app/not-found.tsx` was a static German page by design (that design is
  retired — DECISIONS).
- **Proxy:** returns early for the internal `/_not-found` path (passes through with the
  request headers) and sets `x-language` (the resolved prefix language) on every
  storefront request and on the slug-404 rewrite — the only channel to a route outside
  the `[lang]` tree. `getRequestLanguage()` reads it first: prefix header > `lang`
  cookie > `Accept-Language` > first active row (the proxy's precedence reused).
- **Global 404:** `app/not-found.tsx` static `metadata` → `generateMetadata` + copy
  behind `connection()` reading the label map of the request language (new
  `shop.notFound.body/home/listing` rows; title reuses `shop.meta.notFound.title`);
  `instant = false` only opts the 404 boundary out of the instant/static-shell
  validation. Outside both root layouts the title composes the shared template through
  `titled()` (`site-metadata.ts`), so it carries „| coder-shop" like every page.
  `NotFoundContent` takes the label map; the `[lang]` and admin boundaries pass theirs
  (admin stays the German base map).
- **Same review slice:** the discount refusal `{amount}` formats with the request
  language's `intlLocale` (`createFormatters`), not the base formatters; the discount
  buttons carry `discount-redeem`/`discount-remove` testids and their texts became
  `shop.discount.redeem`/`shop.action.remove` rows, so the French spec selects by
  testid instead of a German button name.
- **Tests:** `tests/request-language.test.ts` +4 (prefix header wins over cookie and
  header, inactive prefix falls through, fr-CH vs de-CH `{amount}`, no-request base
  locale); e2e `validation-translations.spec.ts` +1 (unknown product keeps HTTP 404 on
  the original URL and answers title/body/links in French, unmatched `/fr/…` too) —
  fails on the pre-change build (reproduced: 307 → `/de/_not-found`, „Seite nicht
  gefunden").
- **Gate:** `npm run build`/lint/knip ✅, `npm test` ✅ 599, `npm run test:e2e` ✅
  88/88; tree clean, nothing running.
- **Left open (#58):** unchanged from session 26 — admin strings + admin language
  switcher, mail/invoice/slip/label texts in the recipient's language, the remaining
  core error texts, no-German-literals guard; step 4 remainder (needs-review filter,
  usage context, inline editing, change history); step 5 remainder (translatable
  catalog content + five-language demo content).

## ISSUES — queue session 28 (2026-10-18)

### Gate report finding — the French restock refusal never reached the server ✅ fixed
- **Reproduced** `validation-translations.spec.ts` "the restock form refuses an
  invalid e-mail in French": no toast ever appeared. Root cause was the test, not
  the app — it relaxed the input to `type="text"` to bypass native e-mail
  validation, but React restores the controlled `type` on the next render, so the
  browser blocked the submit and the server action never ran. The spec now sets
  `novalidate` on the form (React does not manage that attribute) and asserts the
  refusal as the sonner toast text the form actually renders.
- **Core-error slice (#58 step 3, the WIP the review session left uncommitted —
  finished and committed here):** the customer-facing cores (register, reset,
  addresses, order claim, checkout, reviews, restock) answer their refusals from
  the translation table in the request language; German bases byte-identical.
  The register core returns `reason: "emailTaken"` so the form highlights the
  e-mail field without matching localized text (#60); the address ceiling became
  `MAX_ADDRESSES_PER_CUSTOMER` with `{max}` in the text; `RESET_SENT` became
  `resetSentMessage(labels)`. New rows `shop.account.error.*`,
  `shop.account.claim.success`, `shop.checkout.error.*`, `shop.review.error.*`,
  `shop.restock.error.*` in all five languages.
- **Tests:** `tests/core-error-messages.test.ts` (integration tests: French +
  byte-identical German refusals through the real cores, `{sku}`/`{max}`
  interpolation, the machine-readable reason) and +2 e2e (French duplicate-
  registration refusal, French restock toast) — all fail on the pre-change build.
- **Gate:** `npm run build`/lint ✅, `npm test` ✅ 609, `npm run test:e2e` ✅
  90/90; tree clean, nothing running.
- **Left open (#58):** unchanged — admin strings + admin language switcher,
  mail/invoice/slip/label texts in the recipient's language, no-German-literals
  guard; step 4 remainder (needs-review filter, usage context, inline editing,
  change history); step 5 remainder (translatable catalog content + five-language
  demo content).

## ISSUES — queue session 29 (2026-10-18)

### #58 gate fix + admin language mechanism, switcher and admin chrome

- **Gate fix (review BLOCKER, refs #58, pushed separately):** the restock spec's
  `el.form` evaluate failed `next build`'s type check (TS2339 on the locator's
  `SVGElement | HTMLElement` element type) — the form is now reached through
  `el.closest("form")`; the refusal assertion moved to the suite's established
  `[data-sonner-toast]` locator (review nit). The review's second nit is recorded
  here, not in code: the 12:15 session's "all fail on the pre-change build"
  overstated — the byte-identical-German-base test passes pre-change by design.
- **Admin slice (#58 step 3):** the prefix-free admin follows the shared `lang`
  cookie through `getRequestLanguage()` (DECISIONS). The admin root layout resolves
  the language behind `connection()`, sets `<html lang>` and wraps the tree in
  `LabelsProvider` + `LabelsSync`; `labels.tsx` and `order-status-badge.tsx` moved
  to the shared `components/` root (review nit — both serve the storefront too).
  New `AdminLanguageSwitcher` (one button per active row, `aria-pressed`) in the
  sidebar footer and the mobile sheet writes the cookie through
  `setLanguageAction` (validates against `getActiveLanguages()`, proxy's exact
  options) and `router.refresh()`es. `ADMIN_NAV` carries `labelKey`s; sidebar,
  mobile nav, shortcuts line and logout read the label map; the login page became
  `generateMetadata` + labels (demo hint via `splitOnPlaceholder` `{var}`); the
  login zod schema is a label-map factory; `session.ts` login/password refusals and
  the admin 404 resolve through `getRequestLabels()`. 39 new `admin.*` rows in all
  five languages, German bases byte-identical to the literals they replaced.
- **Tests:** `tests/admin-language.test.ts` (cookie written with the proxy's
  options; unknown and deactivated codes write nothing — fails pre-change, the
  action does not exist) and `tests/e2e/admin-translations.spec.ts` (switcher to
  French + reload + back; French login page via the cookie) — both verified
  failing on the pre-change build. The switcher's `switchTo` text is a `title`, not
  an `aria-label`, so the translations editor's `getByLabel(/<language>/)` fields
  stay unambiguous (its three specs pass untouched).
- **Gate:** `npm run build`/lint/knip ✅, `npm test` ✅ 612, `npm run test:e2e` ✅
  92/92; tree clean, nothing running.
- **Left open (#58):** step 2 orders + packing UI, step 3 products + catalog-types
  + settings + translations-editor UI, step 4 purchasing + suppliers + stock-units
  + pickup + invoices, step 5 customers + reviews + discounts + mails + dashboard +
  command palette + picker (the palette's own strings included), admin formats
  (still base-locale), step 6 mail/invoice/slip/label texts in the recipient's
  language, step 7 no-German-literals guard; step 4 remainder (needs-review filter,
  usage context, inline editing, change history); step 5 remainder (translatable
  catalog content + five-language demo content).

## ISSUES — queue session 30 (2026-10-18)

### #58 step 2 slice — admin orders + packing in the request language (+ password nit)

- **Gate report checked first — all three findings are the intended, spec-asserted
  behaviour, not regressions.** Live battery at HEAD: `/` → 307 → `/de` (proxy language
  resolution), `/produkte` → 308 → `/products` (former-German-URL redirect,
  `english-urls.spec.ts` asserts exactly these codes), and the 308 stub has no body by
  design — following the chain, `/de/products` answers 200 with 24 product links (the
  prefix-free `href="/products/…"` is the documented cookie-remembered design). The
  gate's checklist still looks for 200 on `/` and `/produkte` and for `/produkt/`
  links — it predates #63/#58 step 2; nothing to fix in code.
- **Orchestrator incident:** while this slice was in progress, the orchestrator's
  commit 864d333 (its own `.agent/orchestrate.sh` change) committed the whole working
  tree — i.e. the slice mid-edit — and pushed it. The follow-up commit finishes the
  four files it caught mid-flight (toast label refs per the address-book pattern,
  non-exported password-schema factory — the swept-up state failed `knip` and the
  react-hooks lint rules) and adds the tests and docs. The slice therefore spans
  864d333 + this commit; together they are the step-2 slice of the posted plan.
- **Slice (plan of 15:0x):** the orders list/detail and packing queue/slip pages
  resolve `getRequestLabels()` behind `connection()` (static metadata →
  `generateMetadata`), the status tabs/badges/timeline read the existing `shop.status.*`
  rows, `PackList`/`StatusTimeline` take the page's label map (the timeline's is
  required — DECISIONS), `TransitionButtons`/`LabelButton`/`PrintButton` use
  `useLabels()`, and `transitionOrderCore`/`createLabelCore`/`getLabelFileCore` plus the
  two actions answer refusals through `getRequestLabels()` (outside a request the first
  active language — German — answers, so scripts and the German specs stay green).
  Shared refusals share one row (`admin.error.orderNotFound`,
  `admin.error.invalidRequest`); `PICKUP_PAYMENT_TYPE_LABELS` became
  `admin.pickup.paymentType.cash|card` rows and was deleted. ~75 new `admin.*` rows in
  all five languages, German bases byte-identical to the literals they replaced (the
  slip's packaging weight interpolates `PACKAGING_GRAMS` through `formatWeight` →
  "150 g", the packing note's inline link uses `splitOnPlaceholder {link}`).
  **Nit from the 13:22 review bundled:** `actions/admin/account.ts` zod messages became
  a label-map factory (`admin.account.currentRequired`,
  `admin.account.passwordMismatch`, length reuses `admin.auth.error.passwordTooShort`
  `{min}`, fallback `shop.action.invalidForm`) and the `password-form.tsx` toast became
  `admin.account.passwordChanged` — the nit is struck from the left-open record.
- **Tests:** `tests/admin-core-messages.test.ts` (4 tests — transition/label/label-file
  refusals in French via the mocked `lang` cookie, German base checked alongside; all 4
  verified failing at 7d69465) and `tests/e2e/admin-orders-translations.spec.ts`
  (switcher → French: orders list heading/tab/columns, order detail sections + French
  transition area, packing heading, German absent; switches back in `finally`). The
  translations missing-filter spec now searches for its seeded row (`q=shop.cart.title`):
  the table outgrew the editor's 200-row list cap with this slice's rows.
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 616 (62 files),
  `npm run test:e2e` ✅ 93/93; tree clean, nothing running.
- **Left open (#58):** step 3 products + catalog-types + settings + translations-editor
  UI; step 4 purchasing + suppliers + stock-units + pickup + invoices; step 5 customers
  + reviews + discounts + mails + dashboard + command palette + picker (the palette's
  own strings included); admin formats (still base-locale); step 6 mail/invoice/slip/
  label texts in the recipient's language (+ UPS provider texts); step 7
  no-German-literals guard; step 4 remainder (needs-review filter, usage context,
  inline editing, change history); step 5 remainder (translatable catalog content +
  five-language demo content). The admin account page's field labels/toasts outside the
  password form stay with the step-5 settings UI area.

## ISSUES — queue session 31 (2026-10-18)

### #58 step 3 slice finished — admin products + catalog-types + settings + translations UI, tests, docs, gate

- **Gate report fixed first:** `translations.spec.ts` failed because the new
  `admin.translations.validation.keyShape` row used `shop.cart.title` as its example
  text — the translation search matches texts too, so `?q=shop.cart.title` listed that
  row first and the spec edited the wrong key. The example became a language-neutral
  pattern description in all five languages; no real key is named in a validation text
  anymore.
- **The 25-file step-3 diff** (pages on `getRequestLabels()` + `generateMetadata`, the
  eight client editors on `useLabels()`, the products/settings/catalog-types cores and
  actions answering refusals from rows, the zod label-map factories) was finished per
  the 15:05 review: `saveTranslationCore`/`saveLanguageCore` in `server/i18n.ts` were
  the last cores still refusing in hard-coded German — they now answer from rows too
  (three new rows: `admin.translations.validation.areaInvalid`,
  `admin.translations.validation.unknownLanguage`,
  `admin.languages.validation.positionInvalid`; the value suffixes `: <key>` were
  dropped — the message names the rule, the payload carries the value).
- **Tests:** `tests/admin-core-messages.test.ts` +7 (623 total) — the two promised
  14:13 nit cases (transitionOrderCore lost conditional write → French conflict via a
  `updateOne` spy; createLabelCore unwritable `data/labels` → French storage refusal,
  order stays packed, chmod restored in `finally`) plus the step-3 refusals in French
  with the German base alongside (product/variant/images unknown id, stale
  `expectedStock` → `stockConflict` with sku, last shipping/payment method
  deactivation, catalog-type key shape + missing dimensions, translation without German
  base, language with a bad code). Every French assertion fails on the pre-change
  build, where these were German literals. e2e: new
  `admin-settings-translations.spec.ts` (switcher → French: product list heading/
  columns/search placeholder, product detail sections + variant field labels, settings
  fields, translation table chrome, German absent, read-only, switches back in
  `finally`) and the promised French status-badge assertion in
  `admin-orders-translations.spec.ts` (a `shop.status.*` badge visible, no German
  status text on the list). Both fail on the pre-change build — those pages were
  hard-coded German there.
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 623 (62 files),
  `npm run test:e2e` ✅ 94/94 (the product-photo 404 lines are the accepted
  placeholder noise of 864d333, they fail nothing); tree clean, nothing running.
- **Left open (#58):** step 4 purchasing + suppliers + stock-units + pickup + invoices
  UI; step 5 customers + reviews + discounts + mails + dashboard + command palette +
  picker + admin account page field labels; admin formats (still base-locale); step 6
  mail/invoice/slip/label texts in the recipient's language (+ UPS provider texts);
  step 7 no-German-literals guard; step 4 remainder (needs-review filter, usage
  context, inline editing, change history); step 5 remainder (translatable catalog
  content + five-language demo content).

## ISSUES — queue session 32 (2026-10-18)

### #65 — gate: entry URLs answered with redirects; gate checked the retired German URLs ✅
- Root cause 1 (shop): since #58 step 2 the proxy redirected **every** prefix-free
  storefront request to `/{lang}{path}` — even when the resolved language was the base
  language — so `GET /` answered 307 and `GET /products` 307 behind the German 308.
  The proxy now serves the base language (first active language row — data, not code)
  directly on the prefix-free URL via an internal rewrite to `/{base}{path}` carrying the
  same `x-language`/`x-localized-path` headers and the cookie refresh; every other
  resolved language keeps the 307 to its prefix (query preserved). `GET /` and
  `GET /products` → 200.
- Root cause 2 (gate): `.agent/orchestrate.sh` still checked the pre-#63 German contract
  (`/produkte` → 200, `/produkt/` links) that REQUIREMENTS forbids — it can never go
  green against the documented English design. The gate now checks `/ /products
  /api/health` → 200 and `/products/` product links; the German 308 mapping stays proven
  by the english-urls e2e spec.
- Verified: new `tests/proxy-language.test.ts` (4: direct 200 + rewrite target incl.
  query, language/path headers on the rewritten request, prefixed URLs untouched, base
  language follows the first active **row** — with fr-first rows `/products` rewrites to
  `/fr/products` and a `lang=de` cookie gets the 307) — fails on the pre-fix build;
  the two outdated security-routes assertions updated; english-urls spec now asserts
  `/` and `/products` 200 + `lang=fr` → 307 `/fr/products`; language-routing spec gained
  the direct-answer test. `npm test` ✅, lint/build ✅, `npm run test:e2e` ✅.

## ISSUES — queue session 33 (2026-10-18)

### #58 storefront finish — mega-menu and comparison page read their texts from the table

- **Gate report first:** the reported `GET / → 500` / `/api/health → 500` were the
  known environmental failure — an embedded mongod could not start on `data/mongo`
  while another instance held it (`NodeNotFound` on the persisted replica-set
  config). No process is running now and the live battery at HEAD is green again:
  `/` 200, `/products` 200 with `/products/…` links, `/api/health` 200, `/produkte`
  308 (the #63 contract). Nothing in code to fix; the review session's #65 record
  stands.
- **The slice (16:24 plan, delivered complete).** `MegaMenu` gained the `labels` prop
  (the Header's established pattern) — „Marken" → `shop.menu.brands`, „Alle {type}" →
  `shop.menu.allOfType` (per-language word order, no concatenation), and the tile now
  renders `COLLECTIONS[0]` with the existing `shop.home.blurb.<collection>` and
  `shop.home.heroDiscover` rows (DECISIONS: one text per concept, deliberate blurb
  copy change). The comparison page reuses its `getLabels(lang)` in the body:
  `shop.compare.heading` (repairs the „{type} compare" #63 artifact), `needTwo`
  (byte-identical — `compare.spec.ts:68` is the check), `discover`, `countLine`
  (`{count}`/`{max}` from `COMPARE_MAX_PRODUCTS`), `caption`, `feature`, `difference`
  (the rendered leading space stays in JSX), `back`; the `?? "Produkte"` fallback is
  gone — with no comparable type the page renders `shop.meta.compare.title` +
  `shop.compare.none` + the `heroDiscover` CTA. 11 new rows in all five languages
  (the seed test enforces); no language code or German literal left in either file;
  type/collection/brand names stay catalog data (step-5 catalog-content boundary).
- **Tests:** new e2e `menu-compare-translations.spec.ts` (4: French mega-menu
  „Marques"/„Tous les …"/„Découvrir maintenant" with the German absent, German
  mega-menu base, French comparison h1/„Caractéristique"/back link with German absent,
  German comparison „Smartphones vergleichen"/„Merkmal" with the „ compare" artifact
  gone). 3/4 verified failing on the pre-change build (stash + rebuild + run); the
  German mega-menu test passes pre-change by design — it is the byte-identity guard.
  Seed test covers the 11 rows × 5 languages automatically.
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 628 (63 files),
  `npm run test:e2e` ✅ 99/99 (the product-photo 404 lines are the accepted
  placeholder noise); tree clean, nothing running.
- **Left open (#58):** step 4 purchasing + suppliers + stock-units + pickup + invoices
  UI (plan of 15:30, next); step 5 customers + reviews + discounts + mails + dashboard
  + command palette + picker + admin account page field labels; admin formats (still
  base-locale); step 6 mail/invoice/slip/label texts in the recipient's language
  (+ UPS provider texts); step 7 no-German-literals guard; step 4 remainder
  (needs-review filter, usage context, inline editing, change history); step 5
  remainder (translatable catalog content + five-language demo content). The
  storefront extraction is finished and struck from the record.

## ISSUES — queue session 34 (2026-10-18)

### #58 (step 4 slice) — purchasing, suppliers, stock-units, pickup and invoices answer in the request language ✅ — issue stays open
- **Gate report first:** `GET /produkte → 308` and „no `/produkt/…` links" are the
  intended #63/#65 contract (former German URLs answer a permanent 308, product links
  are `/products/…`, the gate script itself checks the English contract since #65) —
  asserted by the green `english-urls`/`language-routing` specs in every gate run.
- **The slice (plan on the issue):** the five admin areas resolve
  `getRequestLabels()` behind `connection()` (static metadata → `generateMetadata`),
  the six client forms read `useLabels()` (toast labels through the address-book ref
  pattern), and the purchasing/pickup/invoice cores and their actions refuse from rows
  with byte-identical German bases — so every German spec (purchasing, pickup,
  invoice-payment, serial-stock, incoming-stock) passed untouched. `PO_STATUS_LABELS`
  and `STOCK_UNIT_STATUS_LABELS` were deleted — the badges render
  `admin.po.status.*` / `admin.stockUnits.status.*` rows (`PurchaseOrderStatusBadge`
  takes the page's label map like `OrderStatusBadge`). The supplier zod schemas and
  the invoice amount schema became label-map factories; `listPurchaseOrders` no longer
  embeds the German „Unbekannt" (the page renders the row); the receipt core's
  `message.startsWith("Ungültige Seriennummer")` string match became a typed
  `InvalidSerialError`. Reused rows where the text is the same concept:
  `admin.error.invalidRequest|orderNotFound`, `admin.orders.error.conflict`,
  `admin.orders.column.*`, `admin.action.save|all`, `admin.pickup.paymentType.*`,
  `shop.action.search`, `shop.status.*`. ~175 new `admin.*` rows in all five
  languages (the seed test enforces).
- **Tests:** `tests/admin-core-messages.test.ts` +7 (duplicate supplier name, unknown
  SKU, receive-from-draft, serials-needed counts, wrong handover code, parcel order
  not markable ready, amount-over-open with the formatted amount, junk credit limit /
  unknown customer — French alongside the German base, all fail on the pre-change
  build); new e2e `admin-purchasing-translations.spec.ts` (switcher → French:
  purchasing list + PO detail, suppliers, serial ledger, pickup, invoices; German
  absent; read-only; switches back in `finally`) — verified failing on the pre-change
  build (stash + rebuild), green after.
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 636 (63 files),
  `npm run test:e2e` ✅ 100/100; tree clean, nothing running.
- **Left open (#58):** step 5 customers + reviews + discounts + mails + dashboard +
  command palette + picker (the palette's and picker's own strings included), admin
  formats (still base-locale); step 6 mail/invoice/slip/label texts in the recipient's
  language (+ UPS provider texts); step 7 no-German-literals guard; step 4 remainder
  (needs-review filter, usage context, inline editing, change history); step 5
  remainder (translatable catalog content + five-language demo content).

## ISSUES — queue session 35 (2026-10-18)

### #58 (step 5 slice) — dashboard, customers, reviews, discounts, mails, palette and picker answer in the request language ✅ — issue stays open
- **Pages:** the dashboard, customers (list + detail), reviews, discounts and mails
  pages resolve `getRequestLabels()` behind `connection()` and their static metadata
  became `generateMetadata`; the client pieces (`customer-actions`, `review-actions`,
  `discount-forms`, `password-form`, `picker-dialog`, `command-palette`,
  `revenue-sparkline` via an `ariaLabel` prop) read `useLabels()` with the
  address-book ref pattern for their toasts.
- **Cores and actions:** the customer, review and discount cores refuse from
  `admin.error.*` rows (byte-identical German bases — the German specs passed
  untouched); the reply and discount zod schemas became label-map factories, and the
  discount amount check moved out of a `z.union` into one transform so its refusal
  row is actually shown (DECISIONS). `REVIEW_STATUS_LABELS` is deleted — the reviews
  tabs render `admin.reviews.status.*`; the palette groups travel as machine keys and
  the client maps them to the existing title rows (DECISIONS); the picker's hint,
  empty and shortcut strings became `admin.picker.*` rows.
- **Rows:** ~145 new `admin.*` rows in all five languages (the seed test enforces);
  reused: `admin.error.invalidRequest`, `admin.action.*`, `admin.orders.column.*`,
  `admin.orders.title`, `admin.products.title`, `admin.suppliers.title`,
  `admin.invoices.column.*`, `shop.action.search`,
  `admin.purchasing.error.invalidInput`.
- **Tests:** `tests/admin-core-messages.test.ts` +8 (unknown customer, junk credit
  limit, unknown review, unknown code, discount create/set-active refusals, invalid
  CHF amount, reply validation — French alongside the German base; the action tests
  replay the session cookie per test because the file-wide `afterEach` clears the
  request scope); `tests/command-palette.test.ts` asserts the machine keys; new e2e
  `admin-customers-translations.spec.ts` (registers one customer through the public
  form, switches to Français: dashboard, customers list + detail, reviews, discounts,
  mails, „?" overlay and the ⌘K palette with the French group chip; German absent;
  switches back in `finally`) — all verified failing on the pre-change build
  (stash + rebuild), green after.
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 644 (63 files),
  `npm run test:e2e` ✅ 101/101 twice (one cold-start flake of the untouched
  account-translations home test on the first run, green in both full runs since);
  tree clean, nothing running.
- **Left open (#58):** admin formats (still base-locale); step 6 mail/invoice/slip/
  label texts in the recipient's language (+ UPS provider texts); step 7
  no-German-literals guard; step 4 remainder (needs-review filter, usage context,
  inline editing, change history); step 5 remainder (translatable catalog content +
  five-language demo content).

## ISSUES — queue session 36 (2026-10-18)

### Gate recovery + #58 slice — the admin formats follow the language row ✅ — issue stays open
- **Gate report:** `GET /produkte → 308` and „no `/produkt/…` links" are the intended
  #63/#58 English-URL contract (asserted by the green `english-urls`/`language-routing`
  specs in every gate run). The real findings were the delivery ones: the reviewed
  step-5 slice (26 modified files + the untracked `admin-customers-translations` spec)
  sat uncommitted — re-ran the full gate on that exact tree (build/lint/knip/tsc,
  `npm test` 644, `test:e2e` 101/101, matching the 18:28 review) and delivered it as
  one `refs #58` commit before starting new work, per the 18:33 plan on the issue.
- **Slice (plan of 18:33):** the admin's amounts, dates and weights now follow the
  `intlLocale` of the request language's row instead of the base locale — a French
  admin reads „12'633.90 CHF" and „15 octobre 2026". `getRequestFormatters()`
  (`server/i18n.ts`, mirroring `getRequestLabels()`; outside a request scope the first
  active language answers, so scripts and integration tests stay on the base) feeds the
  16 admin server pages behind their existing `connection()`; `PackList` and
  `StatusTimeline` take the page's `Formatters` like they take its label map;
  `PoCreateForm` (through a ref, keeping the #42 stable picker callbacks) and
  `ShopSettingsForm` read `useFormatters()`. `LocaleFormattersProvider` moved from
  `components/storefront/` to the shared `components/` root (the `labels.tsx`
  precedent) and the admin layout wraps it + `LocaleSync` with the live row's locale —
  the admin is fully dynamic, so no Suspense hole is needed. The named base-locale
  exports stay for the recipient-language boundary only (mails, invoice/QR PDFs, label
  content, seed, scripts — step 6); `format.ts` header and ARCHITECTURE corrected.
- **Agnostic:** no locale literal anywhere — a sixth language row brings its formats
  with no code change; de-CH through `createFormatters` is byte-identical to what the
  named exports produced, so every German admin spec stayed green untouched and is
  itself the regression check.
- **Tests:** `tests/request-language.test.ts` +3 (fr cookie → the fr-CH set, computed
  from `Intl` in the test — no ICU vocabulary pinned; cached identity; outside a
  request the base set answers); new e2e `admin-formats.spec.ts` (switcher Français →
  dashboard and orders list show the CHF suffix form and the lowercase French month,
  the German forms absent; switch back in `finally` → German forms again) — verified
  failing on the pre-change build (stash + rebuild: the `/CHF$/` assertion fails).
- **Along the way:** the `account-translations` home test flaked 2/4 runs on a strict
  `getByText` racing the PPR resume swap (prerendered hero shell and streamed hero
  briefly coexist) — the two hero assertions take `.first()`; the new spec's `finally`
  asserts the German heading of the page it is actually on (orders list).
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 647 (63 files),
  `npm run test:e2e` ✅ 102/102 twice; tree clean, nothing running.
- **Left open (#58):** step 6 mail/invoice/slip/label texts in the recipient's
  language (+ UPS provider texts); step 7 no-German-literals guard; step 4 remainder
  (needs-review filter, usage context, inline editing, change history); step 5
  remainder (translatable catalog content + five-language demo content).

## ISSUES — queue session 37 (2026-10-18)

### #58 (decision slice) — the month-name time bomb defused; the translation table's seed content is one file ✅ — issue stays open
- **Gate report re-checked:** the 500s and the lock message were the known embedded-
  mongod flake (an instance holding `data/mongo` while the gate's `next start` tried to
  start its own); no orphaned mongod at session start, lock file empty, and the live
  battery at this HEAD answers `/`, `/products`, `/api/health` 200 with `/products/`
  links (the German 308s stay proven by the `english-urls` spec).
- **Step 0 (19:12 review):** `tests/e2e/admin-formats.spec.ts` no longer pins month
  names — it derives the long month names of the last 15 days per locale via
  `Intl.DateTimeFormat` (the seed window is `now − rng()×14 days`, so the set always
  covers it; a 15-day window spans at most two months) and asserts the French set
  visible / German set absent on the French admin and mirrored after the switch back.
  Case-sensitive word-bounded patterns keep fr/de distinguishable; the CHF
  prefix/suffix pair stays the primary pre-change-failing assertion. Green today,
  green in every calendar month.
- **Step 1 (user decision of 19:06, point 1):** the ~1070-row seed array left
  `src/lib/i18n.ts` (10 600 → 270 lines, now types + pure functions only) for
  `src/server/translations.json` — one line-object per row in exactly the stored shape
  — with `src/server/translation-seed.ts` as the file's only typed reader (seed,
  server fallback, labels provider). Move, not rewrite: the JSON deep-equals the old
  array (verified before deleting it) and every German spec stayed green untouched.
  `RETIRED_TRANSLATION_KEYS`/`TRANSLATION_TEXT_REPAIRS` stay code — migrations, not
  content (DECISIONS).
- **Agnostic:** the file is data in the collection's shape; a new text is a line, a
  sixth language a new field per row plus a `languages` row; nothing branches on a
  language code.
- **Tests:** new `tests/translations-file.test.ts` (4 — module equals the file, row
  floor ≥ 1071, unique well-formed keys, known areas + non-empty German base, texts
  only for seeded codes and every key translated in all of them) fails without the
  file; the existing i18n/seed suites are the byte-identity check.
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 651 (64 files),
  `npm run test:e2e` ✅ 102/102; live battery green; tree clean, nothing running.
- **Left open (#58):** the decision's points 2–4 (one `t(key, params)` translator per
  request, the mechanical sweep of the remaining literals — mails, invoice/QR PDFs,
  label content, UPS texts — and the no-German-literals guard), the recipient-language
  boundary (store the request language on the order), and the editor remainder.

## ISSUES — queue session 38 (2026-10-18)

### #58 (decision point 3 slice) — mails render from the table in the recipient's language ✅ — issue stays open
- **Gate report re-checked:** `/produkte → 308` and no `/produkt/` links are the
  intended #63/#65 English-URL contract, asserted by the green `english-urls` spec —
  nothing to fix.
- **Stored language:** `Order.language` (checkout), `RestockAlert.language` (subscribe),
  `User.language` (registration) — plain data set from `getRequestLanguage()` where the
  request happens; documents without the field fall back to the first active row.
  `createOrderCore` resolves the language itself (it already resolved the request label
  map — one resolution feeds both), so no action changed.
- **Templates:** `src/lib/mail-templates.ts` is table-driven — every subject, sentence,
  greeting, CTA and the two layout strings are `mail.*` rows (27 new rows × 5 languages
  in `src/server/translations.json`), amounts/dates come from the context's Formatters
  (the `toLocaleDateString("de-CH")` literal in the checkout core dies; the invoice
  mail's due date now follows the mail language), `<html lang>` and the link prefix
  (`/fr/orders/…` via `localizedPath`) follow the same code, the carrier rides as data.
  `getMailContext(language?)` (`src/server/mail-context.ts`) resolves texts + formats;
  admin-triggered mails (label, pickup-ready, reminder, admin reset) use the *stored*
  language, self-service mails the account's.
- **Seed:** sample orders rotate over the active language rows.
- **Tests:** new `tests/mail-templates.test.ts` (7 — German byte-identity of every
  subject/chrome + French texts, Intl-derived fr-CH amounts and long due date, level
  interpolation, all seeded languages filled) and `tests/mail-language.test.ts` (6 —
  mocked request scope: fr checkout stores fr + French mails with `/fr/` links, German
  admin's label/pickup/reminder/reset mails answer in the order's/account's language,
  fr restock alert, fr registration). Adjusted for the localized links: `mails.test.ts`
  (`/de/orders/`, Intl-derived due date) and `restock-alerts.test.ts`
  (`/de/products/…`).
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 663 (66 files),
  `npm run test:e2e` ✅; tree clean, nothing running.
- **Left open (#58):** invoice/QR PDF + packing slip + label content through the table
  (then the named `format.ts` exports retire), the no-German-literals guard over
  `src/` (decision point 4), the editor remainder and translatable catalog content.

## ISSUES — queue session 40 (2026-10-18)

### #58 (step 6 slice) — invoice/QR PDF + label content render from the table in the order's language; named format.ts exports retire ✅ — issue stays open
- **Gate report re-checked (again):** `/produkte → 308` and no `/produkt/` links are the
  intended #63/#65 English-URL contract, asserted by the green `english-urls` spec.
- **Invoice PDF:** `buildInvoicePdf(order, vatRatePercent, ctx)` renders through
  `getMailContext(order.language)` resolved in `getInvoiceFileCore` — the document
  answers the customer, never the requester. 21 new `invoice.pdf.*` rows × 5 languages
  carry every drawn string; the VAT line reuses `shop.checkout.vatNote` (+ `vatLabel`,
  byte-identical to the retired `vatInclusiveNote`), the free line `shop.checkout.free`.
  The SPC payload inside the QR stays German (banking interop data — DECISIONS).
- **Label content:** `LabelRequest.labels` carries the order-language label map as
  plain data (resolved once by `createLabelCore` next to the tracking mail); the mock
  provider prints `shop.label.*` rows (8 new), `labelSerialLines` takes the header as
  a parameter and stays text-free; the real UPS provider ignores the map (API JSON).
- **format.ts retirement:** the named `formatChf`/`formatDate`/`formatDateTime`/
  `formatWeight` exports and `vatInclusiveNote` are deleted — the last consumer
  (`invoices.ts:273`) became `recordInvoicePaymentCore(..., formatters)`, fed by
  `getRequestFormatters()` in the admin action, so the refusal amount follows the
  admin's request language.
- **Latent bug found and fixed:** the discount/received lines drew U+2212, which
  pdf-lib's WinAnsi fonts cannot encode — generating such a PDF threw (never hit by
  any test or flow before). Now an ASCII hyphen; recorded in DECISIONS.
- **Tests:** new `src/test/pdf-text.ts` helper (pdf-lib writes hex `<…> Tj` operands
  into Flate streams — a raw byte search finds nothing; the helper inflates and
  decodes). New `tests/invoice-pdf-language.test.ts` (3 — German byte-identity of
  every drawn string incl. the VAT note, French rows with German absent, Intl-derived
  amounts/dates), +3 in `tests/shipping.test.ts` (header parameter honoured, German
  label byte-identity, French label through the provider), +1 in
  `tests/mail-language.test.ts` (fr order → French invoice PDF, cached; French label
  written by `createLabelCore` under a German admin). `admin-core-messages` amount
  test now asserts the fr-CH amount through the passed Formatters. Verified failing
  at 72c014e: the 3 PDF tests fail there with the genuine WinAnsi crash, the label/
  header tests with real assertion failures.
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 663 (67 files),
  `npm run test:e2e` ✅ 102/102; tree clean, nothing running.
- **Left open (#58):** the no-German-literals guard over `src/` (decision point 4 —
  must exempt stored-data notes: statusLog notes, `CANCEL_NOTE`, unit-move notes, the
  German log line in label.ts, and the SPC payload deliberately), the editor remainder
  (needs-review filter, usage context + preview, inline editing, change history) and
  translatable catalog content + five-language demo content.

### #58 (review follow-up slice) — the mock label's weight follows the order locale; stale formatChf comment gone ✅ — issue stays open
- **Root cause (review of c4486a7):** `MockUpsProvider` built the weight string with
  `(grams/1000).toFixed(2) + " kg"` — the last label text formatted in a fixed locale,
  printing "1.15 kg" on French parcels. `LabelRequest` now carries the `Formatters`
  set `createLabelCore` already resolved via `getMailContext(order.language)`, and the
  mock renders `formatters.weight(grams)` — de-CH byte-identical ("1.15 kg"), fr-CH
  "1,15 kg", sub-kg parcels in the grams branch ("350 g"); the real UPS provider
  ignores the field (API JSON keeps machine formats).
- **Stale comment:** `tests/e2e/settings.spec.ts` still named the retired `formatChf`
  export — reworded to the request locale's Intl CHF formatter.
- **Tests:** the French `MockUpsProvider` spec asserts "Poids : 1,15 kg" and rejects
  "1.15 kg"; the fr-label integration spec asserts "Poids : 350 g" through
  `createLabelCore`. Both verified failing without the fix (2 failed), the German
  byte-identity spec untouched as the regression check.
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅, `npm run test:e2e` ✅.

## ISSUES — queue session 43 (2026-10-18)

### Gate report findings — no defect, re-verified ✅
- `GET /produkte → 308` and „the HTML links to no product page (/produkt/…)" are the
  intended #63 English contract (former German URLs answer a permanent 308, product
  links are `/products/…`), asserted by the green `english-urls`/`language-routing`
  specs in every gate run. No code change.

### #58 (step 3 slice) — the last German literals in `src/` join the table; the no-German-literals guard lands ✅ — issue stays open
- **Rows for the remaining literals (16 new keys × 5 languages, German bases
  byte-identical — `tests/translations-file.test.ts` enforces coverage):** the
  comparison table (`shop.compare.row.*` for Preis/Marke/Gewicht/Varianten/Verfügbar,
  `shop.compare.stockValue.one/.other` as a plural family — a single row would force
  the „pièce(s)" hack the plural mechanism retired; `buildComparisonRows` takes the
  page's `LabelMap`, the sold-out value reuses `shop.state.soldOut`, the „ab" prefix
  reuses `shop.price.from` with the card's join), the star display's aria (reuses the
  review form's `shop.reviews.starAria` — one sentence, one row), the three
  placeholders that render per language (`shop.account.address.labelPlaceholder`,
  `shop.checkout.sample.city`, `shop.restock.emailPlaceholder` — the other checkout
  placeholders stay sample values), the switcher nav aria (`shop.switcher.aria`), the
  vendored dialog/sheet close label (`shop.action.close` — the `useLabels()` hook sits
  at the component top, the button itself renders conditionally), and the invoice
  refusals of both PDF routes (`shop.invoice.notFound`, resolved from the lang param /
  `getRequestLabels()`).
- **Per-language metadata (#58 done-when):** the product page description becomes
  `shop.meta.product.description` (`{name}`/`{vat}`); `SITE_METADATA_BASE` loses its
  German title/description/OG pair — the two root layouts merge `siteMetadata(labels)`
  behind `connection()` (this Next's `DefaultTemplateString` requires `default` with
  `template`, so the template travels with the localized default); the admin layout's
  static `metadata` becomes `generateMetadata` (#37 rule, login-page pattern) and the
  admin 404 title reuses `shop.meta.notFound.title`.
- **Machine values are English (#63):** the translations page's `?area=alle`/
  `?missing=alle` sentinel becomes `all` and the area filter only accepts the known
  area enum, so an old `?area=alle` bookmark degrades to the unfiltered list; the
  catalog-type editor's NEW_CONFIG dimension starts with an empty label (the admin
  types the content label — the save core refuses to persist it blank). The settings
  form's four unwired texts (`Laden`, `Aktiv`, payment-remove aria, Express title)
  read the rows their shipping counterparts already used — no new keys.
- **The guard (decision point 4):** new `tests/no-german-literals.test.ts` walks every
  production file in `src/` (tests, `translations.json` and `translation-seed.ts`
  excluded), extracts string literals + JSX texts through the TypeScript AST (comments
  and identifiers are never scanned), flags German markers (umlauts/ß/„“«» + a
  conservative word list — no English collisions: „position"/„standard"/„ware"/„hat"
  were caught and dropped during development) and fails on anything outside the
  exemption registry. The registry holds exactly the recorded boundaries from the plan
  (stored-data notes, console.error logs, internal UPS errors, SPC payload,
  seed/default content, invisible skeleton fillers, health/search JSON payloads,
  `objectIdSchema`, the unreachable discount fallback, `STATUS_LABELS` fallback) plus
  the health route (the table is unreadable when the DB is down) and the
  `Etikett erstellt` unit-history note; a stale exemption fails its own test.
  Verified: green at HEAD, red on a planted literal, honest registry.
- **Tests:** +1 compare unit test (French row labels, „dès" prefix, „3 pièces"/
  „1 pièce" plural family, German absent — fails without the change), +1 star-rating
  unit test (fr/es aria sentences via `LabelsProvider` — fails pre-change), new e2e
  `remaining-literals.spec.ts` (3: fr compare table, fr product-page meta description +
  localized og:title/og:description + „Langue" switcher aria, full French
  buy→review→approve flow ending on the „5 sur 5 étoiles" aria with „Sternen" absent)
  — all three verified failing on the pre-change build (stashed rebuild: 3 failed).
  German specs (`compare.spec.ts`, `reviews.spec.ts`, seo/settings) stayed green
  untouched as the byte-identity check.
- **Docs:** DECISIONS (guard/exemption rule, localized site metadata, reuse-before-
  adding), ARCHITECTURE (guard paragraph in the Translation section, §12 spec, the
  `compare.ts`/`site-metadata.ts` entries).
- **Gate:** `npm run build`/lint/knip/tsc ✅, `npm test` ✅ 669 (68 files),
  `npm run test:e2e` ✅ 105/105; tree clean, nothing running.
- **Left open (#58):** the editor remainder (needs-review filter, usage context +
  preview link, keyboard-driven inline editing, change history); translatable catalog
  content + admin editing + five-language demo content; the per-area translation e2e
  deletion once the guard has survived a session of real changes; the German route
  segments `/admin/translations/neu` and `/admin/catalog-types/neu` (#63 machine-value
  rule — same category as the `alle` sentinel fixed here); stored-data notes staying
  German remains the recorded decision the guard exempts.
