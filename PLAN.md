# coder-shop — PLAN (milestones M1–M5)

Every milestone ends with: `npm run build` ✅, `npm run lint` ✅, `npm test` ✅,
PROGRESS.md updated (done / open / known issues), git commit `M<n>: …`.
Server checks only via background start + `curl` + stop (never foreground long-running).

## M1 — Scaffold, database, seed

Tasks
1. `create-next-app` (App Router, TS strict, ESLint) pinned to next 16.4.2 / react 19.3.1;
   add all deps at the exact versions from ARCHITECTURE.md §1; Tailwind v4 via
   `@tailwindcss/postcss`; `eslint.config.mjs` flat config; vitest config with `globalSetup`.
2. `shadcn@4.22.0` init; add button, input, select, checkbox, sheet, drawer, dialog, badge,
   table, tabs, skeleton, toast, card, accordion, breadcrumb, avatar, separator, label.
3. `src/lib/env.ts` (zod env), `src/lib/db.ts` single-flight connection helper
   (MONGODB_URI ⇢ external; else MongoMemoryServer with `dbPath: ./data/mongo`),
   `GET /api/health`.
4. Mongoose models + index creation (`syncIndexes` on connect): Product, Order, User,
   Supplier, PurchaseOrder, Counter (§3 of ARCHITECTURE).
5. Vitest `globalSetup` throw-away mongod + cleanup helpers; smoke test connecting and
   round-tripping a Product.
6. `lib/seed/catalog.ts` deterministic 200 products (70/70/60) + `lib/seed/svg.ts` image
   generator; `npm run seed` writes products + images + admin user + suppliers + sample POs
   + sample orders; `--fresh` drops first.
7. Pure libs with unit tests: `pricing.ts` (VAT 8.1 % in/out, rounding, totals),
   `format.ts` (de-CH CHF), `orders/state-machine.ts` (full transition graph),
   `stock.ts` (reserve/release/low-stock).
8. README (run/seed/test, admin credentials), DECISIONS.md, PROGRESS.md, .gitignore updates.

Acceptance
- `npm run build` passes with no mongod running beforehand (no DB at build time).
- `npm test` green; ≥ 25 unit tests covering pricing, state machine, stock, format.
- `npm run seed` exits 0; second run is idempotent; `ls public/products | wc -l` ≥ 200 and
  every product doc has 1–5 images whose files exist on disk.
- `node -e` script (or test) counts products: exactly 70/70/60 by typ; every variant has
  unique sku, stock ≥ 0, weightGrams > 0.
- After `npm run seed`, background `npm run start` + `curl -s localhost:3000/api/health`
  returns `{"ok":true,…}`; server stopped afterwards.
- `npm run lint` passes.

## M2 — Storefront

Tasks
1. Global layout: fonts, theme provider + toggle (class dark), header with mega-menu,
   footer, `RouteTransition` wrapper, toasts.
2. Instant search: `/api/search` + `search-instant.tsx` (debounce 200 ms, keyboard nav,
   a11y combobox pattern).
3. Listing `/produkte`: server first paint + client `ListingShell`, facet sidebar with counts,
   sort, pagination, skeletons, empty state; `/api/products`; URL params `typ,marke,groesse,
   farbe,speicher,material,sort,seite`.
4. Product page: gallery (thumbs, swipe, zoom dialog), variant picker updating price/stock/
   image, stock indicator, qty + add-to-cart, related products, breadcrumbs, JSON-LD.
5. Home: hero, category tiles, featured rails.
6. Cart store + drawer + badge (localStorage, optimistic) — drawer chrome now, contents
   wired in M3 if needed.
7. Motion polish + `prefers-reduced-motion`; responsive audit at 375/768/1440.

Acceptance
- `curl -s "localhost:3000/produkte?typ=schuhe&groesse=42" | grep -c 'produkt/'` > 0 and
  every listed href matches a size-42 shoe (verify via `/api/products` JSON: all items
  `typ=schuhe`, `"42" ∈ filter.groessen`).
- `curl -s "localhost:3000/api/products?typ=smartphone&marke=Apple&sort=preis-auf"` returns
  only Apple phones, ascending `priceCents`; `seite=2` returns the next 24.
- `curl -s "localhost:3000/api/search?q=iphone"` returns ≤ 8 JSON hits.
- Product page HTML contains `"@type":"Product"` JSON-LD and 1–5 `<img>` gallery sources.
- Home, listing, product pages return 200 and contain German copy + `CHF`.
- build/lint/test green.

## M3 — Cart, checkout, orders

Tasks
1. Cart page `/warenkorb` mirroring drawer; free-shipping progress; persisted across reload.
2. Checkout: address form (zod), shipping method (standard CHF 4.90 / express CHF 12.90,
   free ≥ CHF 100), mock payment stub; `createOrder` server action with atomic stock
   decrement + compensation; order number via Counter.
3. Confirmation `/bestellung/[nummer]` with timeline, totals, VAT note.
4. Stock edge cases: out-of-stock variant blocks add-to-cart; last-item race handled.
5. Tests: pricing totals incl. shipping, createOrder stock behavior, order number format.

Acceptance
- `curl -s -X POST localhost:3000/checkout` (or action-call test) with a valid payload
  creates order `B-YYYY-######`, sets status `bezahlt`, and the variant's stock decreased by
  the ordered qty (checked via DB script/test).
- Ordering more than available stock fails with a validation error and leaves stock unchanged.
- Cart survives reload (localStorage key `cart:v1` present in client bundle logic; unit test
  for store serialize/deserialize).
- Confirmation page for the created order returns 200 and shows the order number + status.
- build/lint/test green.

## M4 — Admin: auth, orders, packing, shipping

Tasks
1. Session lib (signed cookie) + `/admin/login` + layout guard; seeded admin.
2. Orders list (status tabs + counts) and detail with state-machine transition buttons
   (`transitionOrder` action, logged timestamps, cancel restocks).
3. Packing queue + pick list + printable slip (`druckansicht`, print CSS) + parcel weight.
4. `ShippingProvider` interface, `UpsShippingProvider` (OAuth client-credentials + Shipping
   API via fetch, only when UPS_CLIENT_ID/SECRET/ACCOUNT set), `MockUpsProvider`
   (deterministic-looking `1Z…` number, pdf-lib label PDF saved to `public/labels/`),
   factory + `createLabel` action/route → order `shipped`.
5. Label button in packing/order detail; tracking shown on customer confirmation.
6. Tests: state machine via action, provider factory selection, mock tracking format `1Z[0-9A-Z]{15,16}`, label PDF magic bytes, cancel-restock.

Acceptance
- `curl -s localhost:3000/admin` without cookie → redirect to `/admin/login`; with seeded
  login cookie → 200.
- Login as seeded admin, transition an order `bezahlt → picking → packed` via UI action;
  `statusLog` has one entry per step with timestamps; illegal jump `packed → bezahlt`
  rejected (test asserts error).
- `POST /api/shipping/label/<orderId>` (mock mode) returns tracking matching `^1Z`, writes a
  PDF starting `%PDF-`, order status becomes `shipped`, `versand.paketGewichtGrams` equals
  Σ qty×weight (+ packaging constant) per unit test.
- Packing slip page contains each line's sku/name/qty and prints (has `@media print` rules).
- build/lint/test green.

## M5 — Purchasing, dashboard, polish

Tasks
1. Suppliers CRUD (list + edit) and PO editor (lines by SKU search); draft → ordered →
   received; receiving increments variant stock transactionally-safe with per-line guard.
2. Dashboard: revenue (paid+ orders, 30 d), open orders count, low-stock table, revenue
   sparkline, recent activity.
3. Polish pass: focus states, aria audit (axe pass on key pages), motion consistency, empty
  /loading states everywhere, 404 pages, metadata/OG, Lighthouse-minded image sizing.
4. README final (UPS env vars, production MONGODB_URI), DECISIONS.md complete, PROGRESS.md
   final.

Acceptance
- Create PO (draft) for 2 SKUs × qty, mark ordered, mark received → variant stocks increased
  exactly by ordered qty (DB check in test); PO status chip shows `received`.
- Dashboard shows Umsatz > 0 given seeded orders; low-stock table lists every variant with
  `stock ≤ restockThreshold` (verified by test comparing query result vs page data source).
- Cancelling a `bezahlt` order restocks; `shipped` cannot be cancelled (test).
- `npm run build && npm run lint && npm test` all green; full smoke: seed → start → curl
  home/listing/product/confirmation/admin → stop.
