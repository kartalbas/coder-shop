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

## Next

M5 — Purchasing, dashboard, polish.
