# coder-shop — PLAN (milestones M1–M6)

Every milestone ends with: `npm run build` ✅ (no mongod running, no env set), `npm run lint` ✅,
`npm test` ✅, `docs/PROGRESS.md` updated (done / open / known issues), git commit `M<n>: …`.
Server checks only via background start + `curl` + stop (never foreground long-running).
`curl` is used only for GET pages and real route handlers — **Server Actions are never curled**:
acceptance checks call the `*Core` functions in `src/server` directly from Vitest integration
tests against the throw-away replica set (ARCHITECTURE §2/§4). All identifiers, statuses and
query params are English; German only in UI copy and public URLs (rewrites, §7).

## M1 — Scaffold, database, seed

Tasks
1. `create-next-app` (App Router, TS strict, ESLint) at the exact ARCHITECTURE §1 pins (incl.
   `tsx`, `@types/node@24.19.2`); Tailwind v4 via `@tailwindcss/postcss`; `eslint.config.mjs`;
   vitest config with `globalSetup` + single-thread pool. Toolchain gate: if a pin combination
   does not build, fall back to the newest that does and record it in `docs/DECISIONS.md`.
2. shadcn init; add button, input, select, checkbox, sheet, drawer, dialog, badge, table, tabs,
   skeleton, toast, card, accordion, breadcrumb, avatar, separator, label.
3. `src/server/env.ts` (zod; `MONGODB_URI`, `UPS_*` optional with defaults); `src/server/db.ts`:
   `MONGODB_URI` → external, else single-node `MongoMemoryReplSet` (dbPath `data/mongo`,
   `mkdir -p` first), promise cached on `globalThis`, async SIGINT/SIGTERM shutdown, lock-error
   retry with clear message, `syncIndexes` once per process; `GET /api/health`. Pin the MMS
   binary + `downloadDir: ".cache/mongod"` in `package.json`; trigger the download once.
4. Mongoose models + indexes (`docs/ARCHITECTURE.md` §3): Product, Order, User, Supplier,
   PurchaseOrder, Counter.
5. Vitest `globalSetup` throw-away in-RAM `MongoMemoryReplSet` + cleanup helpers; smoke test
   round-tripping a Product and a transaction (commit + abort).
6. `scripts/seed/` (`catalog.ts`, `svg.ts`, `seed.ts`): deterministic 200 products (70/70/60),
   1–5 generated SVGs per product into `public/products/`, admin user, 3 suppliers, sample POs,
   ~15 clock-relative orders; idempotent per §9; `--fresh` refuses while another process holds
   the dbPath lock. `npm run seed` → `tsx scripts/seed/seed.ts`.
7. Pure libs with unit tests: `lib/pricing.ts` (VAT rule §8), `lib/format.ts` (de-CH CHF),
   `lib/orders/state-machine.ts` (full graph), `lib/stock.ts` (pure predicates),
   `lib/facets.ts` (`deriveFilter`), `lib/shipping/weight.ts` (`PACKAGING_GRAMS = 150`).
8. README (run/seed/test, admin credentials, lock recovery, `MONGOMS_SYSTEM_BINARY`),
   `docs/DECISIONS.md`, `docs/PROGRESS.md`, `.gitignore` (`data/`, `public/products/*` keeping
   `.gitkeep`, `.cache/`).

Acceptance
- `npm run build` passes with no mongod running and no env set.
- `npm test` green; ≥ 30 unit tests: pricing incl. the VAT rounding rule, every state-machine
  edge, stock predicates, format, `deriveFilter`, parcel weight.
- `npm run seed` exits 0; second run → same collection counts and same order numbers; per
  product `1 ≤ images.length ≤ 5` and every `images[].src` exists on disk; exactly 70/70/60 by
  type; skus unique; stock ≥ 0; `weightGrams > 0`.
- Integration test: a checkout transaction over-sells → aborts, nothing written.
- Background `npm run start` + `curl -s localhost:3000/api/health` → `{"ok":true,…}`; stop.
- `npm run lint` green.

## M2 — Storefront

Tasks
1. Global layout: fonts, theme provider + toggle (class dark), header with mega-menu, footer,
   enter-only `RouteTransition`, toasts; `next.config.ts` rewrites for German URLs (§7).
2. Instant search: `/api/search` (regex-escaped literal prefix) + `search-instant.tsx`
   (debounce 200 ms, keyboard nav, a11y combobox pattern).
3. Listing `/produkte`: server first paint + client `ListingShell`, facet sidebar with counts,
   sort, pagination, skeletons, empty state; `/api/products` via shared `toProductDto()`; URL
   params `type, brand, size, color, storage, material, sort, page`; sorts `price-asc |
   price-desc | newest`, every sort with `_id` tiebreaker, page clamped.
4. Product page: gallery (thumbs, swipe, zoom dialog), variant picker updating price/stock/
   image, stock indicator, qty + add-to-cart, related products, breadcrumbs, JSON-LD.
5. Home: hero, category tiles, featured rails.
6. Cart store + drawer + badge (localStorage `cart:v1`, optimistic) — **working in M2**:
   add-to-cart from product page updates badge and drawer, survives reload.
7. Motion polish + `prefers-reduced-motion`; responsive audit at 375/768/1440.

Acceptance
- `curl -s "localhost:3000/produkte?type=shoes&size=42"` → 200 with product links;
  `/api/products?type=shoes&size=42` JSON: every item `type=shoes`, `"42" ∈ filter.sizes`.
- `/api/products?type=smartphone&brand=Apple&sort=price-asc` → only Apple phones, ascending
  `priceCents`; `page=2` returns the next 24.
- `/api/search?q=iphone` → ≤ 8 JSON hits.
- Product page HTML contains `"@type":"Product"` JSON-LD and 1–5 gallery `<img>` sources.
- Home, listing, product pages 200 with German copy + `CHF`.
- Cart store unit test: serialize/deserialize round-trip; add-to-cart updates badge/drawer.
- Responsive audit + visible focus on interactive elements recorded in `docs/PROGRESS.md`.
- build/lint/test green.

## M3 — Cart, checkout, orders

Tasks
1. Cart page `/warenkorb` mirroring drawer; free-shipping progress (free ≥ CHF 100, standard
   4.90 / express 12.90 — recorded in `docs/DECISIONS.md`).
2. Checkout: address form (zod client+server), shipping method, mock payment stub; `createOrder`
   action → `createOrderCore`: one transaction re-checks stock, decrements variants
   (`findOneAndUpdate` with `$gte` guard), mints `orderNumber` from Counter, inserts `new`,
   mock payment → `paid`.
3. Confirmation `/bestellung/[nummer]` with timeline, totals, VAT note ("8,1 % MwSt.
   inbegriffen", rule §8).
4. Stock edge cases: out-of-stock variant blocks add-to-cart; last-item race fails cleanly.
5. Tests: pricing totals incl. shipping, `createOrderCore` stock behavior, order number format.

Acceptance (integration tests calling `createOrderCore`, not curling actions)
- Valid order → `B-YYYY-######`, status `paid` with `statusLog`, variant stock decreased by
  the ordered qty; concurrent over-sell attempt fails and leaves stock unchanged.
- Ordering more than available stock fails validation; nothing written (transaction abort).
- Cart store survives reload (unit test on `cart:v1` serialize/deserialize).
- Confirmation page for a seeded order returns 200 via curl and shows number + status.
- build/lint/test green.

## M4 — Admin: auth, orders, packing, shipping

Tasks
1. `server/session.ts` (scrypt `scrypt$N$r$p$salt$hash`, 12 h HMAC cookie with `exp`,
   `timingSafeEqual`, login throttle) + `/admin/login` + layout guard; seeded admin.
2. Orders list (status tabs + counts) and detail with transition buttons → `transitionOrderCore`
   (logged timestamps; cancel from `new`/`paid`/`picking` restocks in the same transaction).
3. Packing queue + pick list + printable slip (print CSS) + parcel weight (Σ qty×weight + 150).
4. `ShippingProvider` interface; `UpsShippingProvider` (OAuth token cached until
   `expiresIn − 60 s`, single-flight, API resource/version looked up and pinned in
   `docs/DECISIONS.md`) only when `UPS_CLIENT_ID/SECRET/ACCOUNT` set; `MockUpsProvider`
   (`1Z…`, pdf-lib label → `data/labels/`); `createLabelCore` (only from `packed`, idempotent)
   behind action + `POST /api/shipping/label/[orderId]` (Origin-checked); label served by
   session-guarded `GET /admin/labels/[orderId]`.
5. Label button in packing/order detail; tracking shown on customer confirmation.
6. Tests: `transitionOrderCore` graph incl. cancel-restock, provider factory selection,
   `UpsShippingProvider` with mocked `fetch` (token caching, success, error mapping), mock
   tracking `^1Z[0-9A-Z]{15,16}`, label PDF magic bytes, provider failure keeps `packed`.

Acceptance
- `curl -s localhost:3000/admin` without cookie → redirect to `/admin/login`.
- Integration test: `loginCore` with seeded credentials returns a valid cookie that fetches
  `/admin` → 200; expired or forged cookie rejected; `POST /api/shipping/label/…` with forged
  `Origin` → 403.
- `transitionOrderCore` `paid → picking → packed`: one `statusLog` entry per step; illegal
  `packed → paid` throws `IllegalTransitionError`.
- `createLabelCore` from `packed` (mock mode): tracking `^1Z`, PDF starting `%PDF-` under
  `data/labels/`, order `shipped`, `shipping.parcelWeightGrams` = Σ qty×weight + 150; second
  call returns the same tracking; from `paid` it is rejected; provider failure keeps `packed`.
- Packing slip contains each line's sku/name/qty and `@media print` rules.
- build/lint/test green.

## M5 — Purchasing, dashboard, polish

Tasks
1. Suppliers CRUD (list + edit) and PO editor (lines by SKU search); `draft → ordered →
   received`; `receivePurchaseOrderCore` increments variant stock in one transaction.
2. Dashboard: revenue (statuses `paid | picking | packed | shipped | delivered`, last 30 d),
   open orders, low-stock table (`stock ≤ restockThreshold`), SVG sparkline, recent orders.
3. Polish: focus states, aria audit, motion consistency, empty/loading states, 404 pages,
   metadata/OG, image sizing.
4. README final (UPS env vars, production `MONGODB_URI`), `docs/DECISIONS.md` complete,
   `docs/PROGRESS.md` final.

Acceptance
- Integration test: PO for 2 SKUs × qty → `receivePurchaseOrderCore` → variant stocks increased
  exactly by ordered qty; PO status `received`.
- Dashboard revenue > 0 given clock-relative seeded orders; low-stock table matches the query
  (test compares data source vs expected set).
- Cancelling a `paid` order restocks; `shipped` cannot be cancelled (state-machine + core tests).
- axe-core scan of home/listing/product reports 0 critical violations (or manual a11y review
  recorded in `docs/PROGRESS.md`).
- `npm run build && npm run lint && npm test` green; full smoke: seed → start → curl
  home/listing/product/confirmation/admin → stop.

## M6 — Product photos (image pipeline)

Tasks
1. `scripts/images/` (`prompt.ts`, `api.ts`, `generate.ts`) behind `npm run images`
   (`tsx scripts/images/generate.ts`): for every product image slot `<slug>-<n>` (n = 1–5)
   generate one photo via `POST http://192.168.10.210:8080/v1/images/generations` (OpenAI
   images API: `prompt`, `size: "768x768"`, `seed`; `Authorization: Bearer $LLAMA_API_KEY`),
   normalize to WebP (sharp) and write `public/products/<slug>-<n>.webp`, then record the
   path + German alt on the product document (`images[n]`). One prompt per image: product
   type, variant colour, material (clothing), view (`front | side | back | detail |
   lifestyle` = image 1–5), studio lighting, clean background, **no brand names, no logos,
   no text**; deterministic per-image seed from slug + index.
2. Idempotent/resumable: a slot whose photo file already exists on disk is never re-generated
   (the document path is still repaired if it drifted); `--limit N` generates at most N
   images per run; retries with exponential backoff on network errors / 429 / 5xx (other 4xx
   fail fast); one clear progress line per image; exit 0 iff no generation failed, 1 otherwise.
3. Storefront: shared `ProductImage` component renders the photo when `images[].src` is a
   photo file (`.webp/.jpg/.jpeg/.png/.avif`) and a **neutral placeholder** otherwise (seed
   SVGs are never shown); used in product cards, gallery (main/thumbs/zoom), instant search
   and cart drawer — photos appear everywhere product images show.
4. Unit tests for the pure prompt/seed logic (`prompt.ts`); `LLAMA_API_KEY` missing → clear
   error when a generation is actually needed (skip/repair runs work without it). Generated
   images stay gitignored (already covered by `public/products/*`).
5. Gate fix: `npm run seed` must never reset recorded photo paths — `images` is set only on
   insert (`$setOnInsert`); a drifted document is repaired by the next `npm run images`
   skip pass.

Acceptance
- `npm run images -- --limit 2` (the only generation runs before the gate): exactly 2 new
  `.webp` files under `public/products/`, product documents updated, progress lines printed,
  exit 0; a re-run prints "skipped (already on disk)" for the existing files (skips are free,
  they do not consume `--limit`) and exits 0.
- Prompt unit tests: every view name appears, colour/material/type in the prompt, no brand
  name, no-logo/no-text constraints present, seed deterministic.
- Storefront HTML: products with photos render `/products/<slug>-<n>.webp` `<img>` sources;
  products without photos render the neutral placeholder (no `.svg` in product image markup).
- Full generation is run by the lead after the gate (not part of this milestone's checks).
- After the full batch **and** an idempotent `npm run seed` re-run, every `images[].src`
  still points at its `.webp` file, and listing/product HTML references only `.webp`
  product images (gate finding: re-seed had reset the documents to `.svg`).
- `npm run build && npm run lint && npm test` green.
