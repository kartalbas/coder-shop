# coder-shop — Architecture

Production-grade e-commerce system. Full-stack TypeScript, Next.js App Router, MongoDB via
Mongoose, no installed database required locally (mongodb-memory-server). UI language German,
currency CHF (de-CH), Swiss VAT 8.1 % included in prices.

**Language rule (one language for code):** all identifiers, statuses, model fields, sort values,
query params and route-segment code names are **English** (`new`, `paid`, `picking`, `packed`,
`shipped`, `delivered`, `cancelled`; `customer`, `lines`, `totals`…). German appears **only** in
UI copy and in the public URL paths `/produkte`, `/produkt/…`, `/warenkorb`, `/kasse`,
`/bestellung/…`, which are mapped to English-named routes via `rewrites` in `next.config.ts`
(§7).

## 1. Stack (exact newest stable versions, verified with `npm view <pkg> version` on 2026-10-17)

| Package | Version | Role |
|---|---|---|
| next | 16.4.2 | App Router, Server Components, Server Actions, route handlers |
| react / react-dom | 19.3.1 | UI |
| typescript | 7.0.2 | strict mode |
| tailwindcss | 4.3.3 | styling (CSS-first config, `@theme`) |
| @tailwindcss/postcss | 4.3.3 | PostCSS plugin for Tailwind v4 |
| shadcn | 4.22.0 | CLI that vendors UI components into `src/components/ui` |
| mongoose | 9.11.2 | ODM, typed schemas, indexes |
| mongodb-memory-server | 11.3.0 | embedded **single-node replica set** (`MongoMemoryReplSet`) for dev/seed (persistent `./data/mongo`) and tests — real transactions (§6) |
| vitest | 5.0.5 | unit/integration tests |
| @vitejs/plugin-react | 6.1.2 | React transform for vitest (component tests if needed) |
| eslint | 10.13.0 | linting, flat config (`eslint.config.mjs`) |
| eslint-config-next | 16.4.2 | Next lint rules |
| tsx | 4.23.15 | runs `scripts/seed/seed.ts` (`npm run seed`) |
| zod | 4.6.7 | validation of actions, API input, env |
| motion | 14.3.0 | Framer Motion (import from `motion/react`) |
| clsx | 2.1.1 | class composition |
| tailwind-merge | 3.7.0 | `cn()` helper |
| class-variance-authority | 0.7.1 | shadcn variants |
| lucide-react | 1.58.0 | icons |
| tw-animate-css | 1.4.0 | animation utilities for shadcn on Tailwind v4 |
| pdf-lib | 1.17.1 | generated PDF labels (mock provider) + packing slip |

Dev types: `@types/node` **24.19.2** (pinned to the installed Node 24 runtime, not `latest`),
`@types/react` 19.3.0, `@types/react-dom` 19.3.0.
Password hashing: `node:crypto` scrypt with explicit params (§4). Sessions: HMAC-signed cookie
(`node:crypto`), httpOnly, SameSite=Lax, with expiry (§4).

**Toolchain gate (M1 task 1):** the scaffold task ends only when `next build` + `lint` + `vitest`
are green on these pins (TypeScript 7.0.2 with Next 16.4.2). If a combination does not build,
fall back to the newest combination that does and record the actual versions in
`docs/DECISIONS.md`.

**mongodb-memory-server binary (undeclared-network-dependency fix):** pin the mongod binary
version via the `mongodb-memory-server` config block in `package.json` (`version` — value
verified against the MMS 11 support matrix during M1 — and `downloadDir: ".cache/mongod"`,
gitignored). M1 triggers the download once so later runs are offline. `MONGOMS_SYSTEM_BINARY` is
documented in README as the fallback for distros where auto-detection fails; the distro check
result is recorded in `docs/DECISIONS.md`.

## 2. Folder structure (layers as requirements)

`src/lib` holds **pure domain logic only** — no I/O: pricing, stock rules, state machine,
formatting, facet derivation, validation schemas, shipping weight math, provider types.
Everything with I/O lives in `src/server`: db connection, session, search queries, shipping
providers, server actions. The seed and image generator live in `scripts/`.

```
public/products/            # generated SVG product images (seed output; content gitignored, .gitkeep kept)
data/mongo/                 # persistent mongod dbPath (gitignored)
data/labels/                # generated shipping label PDFs (gitignored; NOT under public/ — PII, §4)
.cache/mongod/              # mongodb-memory-server binary download cache (gitignored)
scripts/
  seed/
    seed.ts                 # deterministic seed entry (npm run seed → tsx scripts/seed/seed.ts)
    catalog.ts              # deterministic product data generation (mulberry32 PRNG)
    svg.ts                  # SVG image generator (silhouettes, colors, angles)
src/
  app/
    layout.tsx              # root: fonts, ThemeProvider, Toaster, <RouteTransition>
    globals.css             # Tailwind v4 @theme, light/dark tokens
    (storefront)/
      layout.tsx            # Header (mega-menu, search, cart badge) + CartDrawer + Footer
      page.tsx              # home
      products/page.tsx     # listing — public URL /produkte (rewrite)
      products/[slug]/page.tsx      # public URL /produkt/[slug]
      cart/page.tsx         # full cart page — public URL /warenkorb (drawer is global)
      checkout/page.tsx     # public URL /kasse
      order/[number]/page.tsx      # confirmation + status — public URL /bestellung/[nummer]
    admin/                  # admin URLs stay English (internal)
      layout.tsx            # session guard (server), sidebar
      login/page.tsx
      page.tsx              # dashboard
      products/page.tsx, products/[id]/page.tsx
      orders/page.tsx, orders/[id]/page.tsx
      packing/page.tsx, packing/[id]/page.tsx (+ print view)
      purchasing/page.tsx, purchasing/[id]/page.tsx, suppliers/page.tsx
      labels/[orderId]/route.ts    # GET label PDF (session-guarded, §4)
    api/
      search/route.ts       # GET instant search JSON
      products/route.ts     # GET faceted listing JSON (client navigation data source)
      health/route.ts       # GET { ok } — also warms DB connection
      shipping/label/[orderId]/route.ts  # POST create label (admin, Origin-checked, §4)
  components/
    ui/                     # shadcn components (button, dialog, drawer, sheet, …)
    storefront/
      header.tsx, mega-menu.tsx, search-instant.tsx, theme-toggle.tsx
      cart-drawer.tsx, cart-button.tsx, product-card.tsx
      filter-sidebar.tsx, sort-select.tsx, pagination.tsx, skeletons.tsx, empty-state.tsx
      gallery.tsx, variant-picker.tsx, stock-indicator.tsx, related-products.tsx
      breadcrumbs.tsx, json-ld.tsx, route-transition.tsx
    admin/
      sidebar.tsx, order-status-badge.tsx, status-timeline.tsx, product-form.tsx,
      variant-editor.tsx, po-lines-editor.tsx, pack-list.tsx, label-actions.tsx
  models/
    product.ts order.ts user.ts supplier.ts purchase-order.ts counter.ts
  lib/                    # PURE domain logic — no I/O, no mongoose, no fs, no fetch
    format.ts             # CHF de-CH, dates, weights
    pricing.ts            # gross/net VAT 8.1 %, totals, VAT rounding rule (§8 note)
    stock.ts              # pure predicates: canFulfill, applyDelta, isLowStock
    facets.ts             # deriveFilter(variants) — pure facet derivation (§3/§4)
    orders/state-machine.ts # transitions + validation + logging (pure)
    shipping/types.ts     # ShippingProvider interface, label/tracking result types
    shipping/weight.ts    # parcel weight = Σ qty×weight + PACKAGING_GRAMS (150 g constant)
    validations/          # zod schemas shared by actions + forms
  server/                 # ALL I/O: db, session, queries, providers, actions
    db.ts                 # single connection helper (see §6)
    env.ts                # zod-validated env access (MONGODB_URI, UPS_* optional w/ defaults)
    session.ts            # admin login/session cookie (scrypt, HMAC, expiry, throttle)
    search.ts             # Mongo query/aggregate builders + toProductDto() shared DTO mapper
    shipping/provider.ts  # factory (env-driven)
    shipping/ups.ts       # UpsShippingProvider (UPS REST, token cache, §4)
    shipping/mock.ts      # MockUpsProvider (1Z…, pdf-lib label → data/labels/)
    actions/
      checkout.ts         # thin action wrapper → createOrderCore (transaction)
      admin/products.ts   # updateProduct, updateVariant, toggleFeatured → *Core fns
      admin/orders.ts     # transitionOrder → transitionOrderCore
      admin/purchasing.ts # createSupplier, createPurchaseOrder, markOrdered,
                          # receivePurchaseOrder → *Core fns (transaction)
      admin/auth.ts       # login/logout → loginCore (testable without cookies())
      admin/shipping.ts   # createLabel → createLabelCore
  stores/
    cart.ts               # useSyncExternalStore store, localStorage-persisted
  hooks/
    use-debounce.ts, use-media-query.ts
  test/
    setup.ts              # globalSetup: throw-away MongoMemoryReplSet (§6)
vitest.config.ts  eslint.config.mjs  next.config.ts  components.json  postcss.config.mjs
```

Server Actions are **thin wrappers** (parse zod input, call the `*Core` function in
`src/server`, `revalidatePath`, return `{ ok } | { error }`). All business behavior is tested by
calling the core functions directly in Vitest integration tests — no need to mock
`cookies()`/`revalidatePath` or forge Next action headers.

## 3. Mongoose models (document-oriented)

All models: `{ versionKey: false }`, timestamps where useful. Money is **integer cents**
(`priceCents` etc.), gross (VAT 8.1 % included). Weights in **grams**. All field names English.

### Product (`products`)
```ts
{
  slug: string            // unique
  name: string
  description: string
  type: 'smartphone' | 'shoes' | 'clothing'
  brand: string
  priceCents: number      // base gross price
  images: [{ src: string, alt: string }]        // 1–5, /products/<slug>-<n>.svg
  featured: boolean
  collection?: string     // e.g. "Neuheiten", "Bestseller"
  filter: {               // denormalized facet source, derived from variants — see rule below
    colors: string[]
    sizes: string[]       // EU sizes "36".."47" or XS..XXL
    storage: number[]     // GB, smartphones only
    materials: string[]   // clothing only
  }
  variants: [{
    sku: string                     // unique across all products
    label: string                   // e.g. "42 / schwarz", "256 GB / titan"
    priceDeltaCents: number
    stock: number
    restockThreshold: number        // low-stock alert level
    weightGrams: number
    attributes: { color: string, size?: string, storage?: number, material?: string }
  }]
  createdAt, updatedAt
}
```
**`filter` maintenance rule:** `filter` is recomputed with the pure `deriveFilter(variants)`
(`src/lib/facets.ts`) and written **inside every operation that creates or touches variants**
(seed, `updateVariant`, `updateProduct`). Document middleware is never relied on — Mongoose
hooks do not run on `findOneAndUpdate`/`updateOne`, which is exactly how the block would go
stale. Unit-tested; an integration test asserts "edit a variant's colour → listing facet
reflects it".

Indexes:
- `{ slug: 1 }` unique
- `{ 'variants.sku': 1 }` unique
- `{ type: 1, brand: 1 }`, `{ type: 1, 'filter.sizes': 1 }`, `{ type: 1, 'filter.storage': 1 }`,
  `{ type: 1, 'filter.colors': 1 }`, `{ type: 1, 'filter.materials': 1 }` — faceted filters
- `{ type: 1, priceCents: 1 }`, `{ type: 1, createdAt: -1 }` — sorting
- `{ featured: 1, type: 1 }` — home page
- text index `{ name: 'text', description: 'text', brand: 'text' }` — search (default analyzer;
  German stemming is **not** used — recorded in DECISIONS)
- Listing queries hit compound filters + sort with `{ type: 1, ...facet..., <sort>: 1 }` shapes;
  **every sort appends `_id: 1` as tiebreaker** (stable pagination) and `page` is clamped to
  `[1, ceil(total/pageSize)]`. The aggregate for facets uses `$facet` over the type-filtered set.

### Order (`orders`)
```ts
{
  orderNumber: string     // unique, "B-2026-000123" via atomic counter
  status: 'new' | 'paid' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'cancelled'
  statusLog: [{ status, at: Date, note?, by? }]
  customer: { name, email, phone, street, postalCode, city, country }
  lines: [{ productId, sku, name, variantLabel, qty, unitPriceCents,
            totalCents, weightGrams }]
  totals: { subtotalCents, shippingCents, totalCents, vatCents }
  shipping: { method: 'standard'|'express', carrier?: 'ups',
              trackingNumber?, labelPath?, parcelWeightGrams? }
  payment: { method: 'mock', reference: string, paidAt?: Date }
  createdAt, updatedAt
}
```
Indexes: `{ orderNumber: 1 }` unique, `{ status: 1, createdAt: -1 }`, `{ 'customer.email': 1 }`.

### User (`users`) — admin login
`{ email (unique, lowercase), name, passwordHash, role: 'admin' }` — `passwordHash` format
`scrypt$N$r$p$salt$hash` with explicit params (§4).
Seeded: `admin@codershop.ch` / `Admin!2026` (documented in README).

### Supplier (`suppliers`)
`{ name, email, phone?, leadTimeDays, active }`.

### PurchaseOrder (`purchase_orders`)
```ts
{
  poNumber: string        // unique "E-2026-00042"
  supplierId: ObjectId
  status: 'draft' | 'ordered' | 'received'
  lines: [{ productId, sku, qty, unitPriceCents, received: number }]
  totalCents: number
  orderedAt?, receivedAt?: Date
}
```
Indexes: `{ poNumber: 1 }` unique, `{ status: 1, createdAt: -1 }`.

### Counter (`counters`)
`{ _id: 'order'|'po', seq: number }` with `findOneAndUpdate({$inc})` for gap-free numbers.

## 4. Server functions, actions and route handlers

Every action is a thin wrapper over a pure-ish **core function** in `src/server` (B1):
`createOrderCore`, `transitionOrderCore`, `loginCore`, `createLabelCore`,
`receivePurchaseOrderCore`, `updateVariantCore` … Core functions take plain data, return typed
results and are covered by Vitest integration tests against the real replica set.

- `createOrderCore(cart, customer, shippingMethod)` — validates, then runs **one MongoDB
  transaction** (single-node replica set, §6): re-check stock, decrement each variant with
  `findOneAndUpdate({ 'variants.$[v].stock': { $gte: qty } })`, mint `orderNumber` from the
  counter, insert the order `status: 'new'`, mock payment → `paid` immediately. Any failure
  aborts the transaction — **no compensation scheme** (removed; the transaction is the
  rollback). Stock model decision (docs/DECISIONS.md): decrement at `createOrder`, restock on
  cancel — **no reservations**; `lib/stock.ts` stays pure (predicates only), the DB loop lives
  here.
- `transitionOrderCore(orderId, to, note, by)` — delegates to the state machine; cancel from
  `new`/`paid`/`picking` restocks **in the same transaction** (§5).
- `receivePurchaseOrderCore(poId)` — increments `variant.stock` per line and sets `received`
  in one transaction.
- `updateProductCore` / `updateVariantCore` / `toggleFeaturedCore` — every update touching
  variants recomputes `filter` via `deriveFilter` (§3 rule).
- `loginCore(email, password)` — scrypt verify + signed cookie value; `logout`.
- `createLabelCore(orderId)` — legal **only from `packed`**; idempotent: if the order is
  already `shipped` with a tracking number, returns the existing one. Provider must succeed
  **before** the order moves to `shipped`; on provider failure the order stays `packed`
  (explicit test). Writes the PDF to `data/labels/<orderNumber>.pdf` (outside the web root —
  labels contain customer PII and must never sit under `public/`), stores `labelPath` +
  tracking, transitions to `shipped`.

Route handlers (all `export const runtime = 'nodejs'`, §6 deployment decision):
- `GET /api/search?q=` → ≤8 hits `{ slug, name, type, priceCents, image, variantHint }`
  (debounced client-side). User input is regex-escaped and matched as a **literal prefix**
  (enough at 200 docs; no raw regex → no injection/ReDoS); text index covers name/brand.
- `GET /api/products?type=&brand=&size=&color=&storage=&material=&sort=&page=` → the exact DTO
  the server page renders, produced by the shared `toProductDto()` mapper in `src/server/search.ts`
  (ObjectId→string, Date→ISO, `filter` shape) so client and server never hydrate different
  shapes. Consumed by the client listing shell (URL stays the source of truth via
  `router.replace`, `scroll:false`). Sort values: `price-asc | price-desc | newest`.
- `POST /api/shipping/label/[orderId]` → label creation (same core function as the action).
- `GET /admin/labels/[orderId]` → serves the label PDF (`Content-Type: application/pdf`)
  **behind the admin session guard** — the only way to read a label.
- `GET /api/health` → `{ ok: true, db: 'memory-server' | 'external' }`.

**Admin security (recorded in docs/DECISIONS.md):**
1. **Origin check:** every state-changing route handler validates the request `Origin` against
   the host and rejects mismatches with 403 (Next does this for Server Actions in App Router;
   the custom route handler must do it explicitly). Test: forged `Origin` → rejected.
2. **Session cookie:** payload `{ userId, exp }` (12 h), signature covers `exp`, verified with
   `crypto.timingSafeEqual`; a leaked cookie expires.
3. **scrypt params:** N=2^15, r=8, p=1, 16-byte random salt, 32-byte key; stored as
   `scrypt$N$r$p$salt$hash` so params are self-describing.
4. **Login throttle:** in-memory failed-attempt counter per IP+account (e.g. 5 attempts /
   15 min lockout) — acceptable for this single-process app; credentials are public in README.

**UPS provider details:** OAuth client-credentials token cached in-process until
`expiresIn − 60 s` with single-flight refresh and the Basic auth header per UPS spec; the
Shipping API resource/version and token endpoint are looked up (never guessed) when M4 starts
and pinned in `docs/DECISIONS.md`; the label response is a base64 PDF (`labelImageFormat=PDF`)
decoded and written to disk; HTTP/API errors map to a typed failure. `UpsShippingProvider` is
unit-tested with `fetch` mocked (token caching, success, error mapping) — not only the factory
and the mock.

## 5. Order state machine (`src/lib/orders/state-machine.ts`)

```
new → paid → picking → packed → shipped → delivered
cancelled reachable from: new, paid, picking   (not from packed/shipped/delivered)
```
- `canTransition(from, to): boolean` from an explicit adjacency map.
- `transition(order, to, { note, by })`: validates, sets `status`, appends
  `{ status, at: new Date(), note, by }` to `statusLog`; throws `IllegalTransitionError`
  otherwise. Same-state transition rejected (double-clicks on transition buttons are guarded
  client-side; label double-clicks are handled by `createLabelCore` idempotency instead).
- Label creation is the canonical path into `shipped`, legal **only from `packed`** (enforced
  in `createLabelCore`, tested).
- **Restock on cancel from `new`, `paid` and `picking`** — stock is decremented at
  `createOrder` while the status is still `new`, so cancelling `new` must restock too.
- Pure function over plain data → fully unit-tested (every edge of the graph).

## 6. Database lifecycle (mongodb-memory-server, replica set for real transactions)

Transactions (checkout, cancel-restock, goods receipt) require a replica set, so dev/seed/tests
all use **`MongoMemoryReplSet` (single-node)** — no compensation scheme anywhere.

`src/server/db.ts` — single `connectDB(): Promise<Mongoose>`:
1. `MONGODB_URI` set → `mongoose.connect(MONGODB_URI)` (production path; URI must be
   replica-set-capable since core functions use sessions).
2. Else start `MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger',
   dbPath: path.resolve('data/mongo') } })` (the directory is `mkdir -p`-ed first) and connect
   to its URI with `directConnection` semantics.
3. **Cache the promise, not the instance:** `globalThis.__mongoPromise ??= startAndConnect()` —
   HMR-safe single-flight; concurrent callers await the same promise and two module instances
   can never start two mongods.
4. **Shutdown:** `SIGINT`/`SIGTERM` async handlers `await replSet.stop()` then `process.exit()`
   (`process.on('exit')` is sync-only and would orphan mongod / leave the WiredTiger lock).
   On startup lock errors: retry 3× with backoff, then fail with a clear message ("stop the dev
   server or delete `data/mongo/mongod.lock`"); the recovery procedure is in the README.
5. `syncIndexes()` runs **once per process** after the first connect (guard flag), not per call.

- **dev** (`npm run dev`): on-demand via helper; data persists in `./data/mongo` across restarts.
- **seed** (`npm run seed` → `tsx scripts/seed/seed.ts`): same helper; `--fresh` drops the
  database first but **refuses with a clear error when another process holds the dbPath lock**
  (dev server running); script stops the replset and exits 0.
- **build**: no DB access at build time. All DB-backed routes are `export const dynamic =
  'force-dynamic'` (or `revalidate = 0`); static shells (admin login, layout) prerender fine.
  `env.ts` marks `MONGODB_URI` and `UPS_*` optional with defaults so `next build` without env
  succeeds. `next build` must succeed with no mongod running — an acceptance check every
  milestone.
- **tests** (vitest): `globalSetup` starts a throw-away `MongoMemoryReplSet` (in-RAM, no
  dbPath), exports its URI to workers; the pool runs **single-threaded**
  (`poolOptions: { threads: { singleThread: true } }`) so the shared mongod is never queried
  while another file wipes collections — cheap at this scale and keeps the "npm test green"
  gate non-flaky. Unit tests of pure lib logic need no DB.
- **deployment target (docs/DECISIONS.md):** a long-running Node server (`next start`). All
  routes `runtime = 'nodejs'` (mongoose/MMS fail on edge). Production requires `MONGODB_URI`;
  the memory server is dev/seed/test only. `data/mongo` and `data/labels` assume one
  persistent filesystem.

## 7. Client/server split (SPA feel)

- **Public URLs are German, code names English:** `next.config.ts` `rewrites` map
  `/produkte` → `/products`, `/produkt/:slug` → `/products/:slug`, `/warenkorb` → `/cart`,
  `/kasse` → `/checkout`, `/bestellung/:number` → `/order/:number`. Query params are English
  (`type, brand, size, color, storage, material, sort, page`) because they are code-facing.
- **Server Components** own data fetching: home, listing first paint, product page, all admin
  pages render from Mongoose directly (no client fetch waterfall, no API keys in bundle).
- **Client islands**: header + mega-menu + instant search, cart drawer/button, theme toggle,
  gallery, variant picker, filter sidebar/sort/pagination, route transition wrapper, admin
  editors.
- **Listing SPA pattern**: `/produkte` server-renders page 1 and hydrates a `ListingShell`
  (client) that owns subsequent updates: facet clicks call `router.replace(url, { scroll:
  false })` and fetch `/api/products` in parallel; results cross-fade with motion; skeletons
  while pending; `history` back/forward works because URL is the single source of truth.
- **Cart**: `src/stores/cart.ts` — tiny external store (`useSyncExternalStore`), persisted to
  `localStorage` (`cart:v1`), hydrated after mount (no SSR mismatch), badge + drawer update
  optimistically from any page; quantity changes animate.
- **Navigation**: `next/link` prefetch on viewport entry; `<RouteTransition>` keys on
  `usePathname()` with motion fade/slide **enter-only** (150–250 ms, respects
  `prefers-reduced-motion`) — App Router unmounts the old tree immediately, so exit animations
  are explicitly not attempted; mega-menu opens on hover (desktop) / tap (mobile).
- **Mutation UX**: checkout and admin actions use `useActionState`/`useFormStatus` with
  optimistic UI where safe (cart, wishlist-free), toasts for feedback.

## 8. UX concept per page

Global: mobile-first, dark mode via `next-themes`-style class strategy (own tiny provider,
`prefers-color-scheme` default, toggle in header), visible focus rings, semantic landmarks,
German copy, CHF formatted `Intl.NumberFormat('de-CH', { style:'currency', currency:'CHF' })`.

**VAT rounding rule (unit-tested):** `vatCents = grossCents − round(grossCents × 100 / 108.1)`
where `grossCents` is the VAT-inclusive total; pricing tests and the confirmation page must
agree by construction. **Packaging constant:** `PACKAGING_GRAMS = 150` in
`src/lib/shipping/weight.ts`, unit-tested; parcel weight = Σ qty×weightGrams + 150.
**Shipping prices (docs/DECISIONS.md):** standard CHF 4.90, express CHF 12.90, free shipping
from CHF 100 subtotal.

- **Home** — full-bleed hero (headline, CTA, featured product collage with parallax float),
  category tiles (smartphones/schuhe/kleidung) with hover zoom, "Beliebte Produkte" rail
  (horizontal scroll-snap), featured collection band. Motion: staggered fade-up on load.
- **Header** — sticky, blur backdrop; logo, mega-menu (type → brand/attribute columns + promo
  tile), instant search (debounce 200 ms, `⌘K`/`/` focus, arrow-key + Enter navigation,
  `role="combobox"`/`aria-expanded`), theme toggle, cart button with animated count badge.
- **Listing /produkte** — left facet sidebar (checkbox groups per type: brand, size, color,
  storage, material; counts per facet), top bar (result count, sort select, mobile filter
  sheet), responsive product grid (2/3/4 cols), skeleton cards, empty state with reset action,
  numbered pagination + "Zeige 1–24 von 70". URL params: `type, brand, size, color, storage,
  material, sort, page`.
- **Product page /produkt/[slug]** — breadcrumbs; gallery (main image + thumbnails, swipe via
  drag, click-to-zoom dialog, crossfade on variant color change); title, price (animated on
  variant change), variant pickers (color/size/storage chips, disabled when out of stock),
  stock indicator (grün/gelb/rot text + dot), qty stepper, "In den Warenkorb" (opens drawer),
  weight/description accordion, related products (same type+brand first), JSON-LD `Product`
  with offers per variant.
- **Cart drawer / /warenkorb** — drawer from right (sheet), line items with variant label, qty
  steppers (optimistic), subtotal, free-shipping progress bar, "Zur Kasse"; full page mirrors
  drawer for deep links.
- **Checkout /kasse** — single column, 3 anchored steps (Adresse → Versand → Zahlung),
  zod-validated client + server, mock payment (card form stub), summary sidebar sticky;
  success → confetti-light motion → redirect confirmation.
- **Bestellung/[nummer]** — big confirmation, status timeline (state machine steps), items,
  totals incl. VAT note "8,1 % MwSt. inbegriffen", tracking number once shipped.
- **Admin login** — centered card, demo credentials hint.
- **Admin dashboard** — KPI cards (Umsatz 30 Tage, offene Bestellungen, Lieferungen
  ausstehend), low-stock table (stock ≤ restockThreshold), recent orders, revenue sparkline
  (SVG, no chart lib). Revenue = orders with status `paid | picking | packed | shipped |
  delivered` (excludes `new` and `cancelled`) within the last 30 days.
- **Admin Products** — searchable table (debounced), inline stock edit, edit page with variant
  table (price delta, stock, weight, attributes), image preview strip, featured toggle.
- **Admin Orders** — status filter tabs with counts, table, detail page with status timeline +
  allowed-transition buttons (server-validated), cancel with restock note.
- **Admin Packing** — queue of `picking`/`packed` orders; per order: pick list (sorted by
  shelf-ish sku), printable packing slip (`/admin/packing/[id]` print view, `@media print`),
  computed parcel weight (§8 constants), "UPS-Etikett erstellen" → transitions to shipped,
  shows tracking + PDF link (`/admin/labels/[orderId]`).
- **Admin Purchasing** — suppliers CRUD-lite, PO list with status chips; PO editor (add lines
  by SKU search, qty, cost); buttons "Bestellen" (draft→ordered) and "Wareneingang"
  (→received, transaction increments stock, toast with delta summary).

## 9. Seed data (deterministic, idempotent, clock-relative)

`scripts/seed/catalog.ts` uses a seeded PRNG (mulberry32, fixed seed) — same 200 products every
run: 70 smartphones (brands Apple/Samsung/Xiaomi/Google/OnePlus; storage 64–512 GB; colors),
70 shoes (Nike/Adidas/Puma/On/Running…; EU 36–47; colors), 60 clothing (Northface…; XS–XXL;
materials). Realistic German descriptions from template pools, CHF price ranges per type,
variant stock 0–80 (a few at 0 and a few below threshold for alerts), weights per type range.
`scripts/seed/svg.ts` writes 1–5 distinct SVGs per product to `public/products/`: type
silhouette (phone/shoe/shirt path), variant color fill, angle/detail variation (rotation, zoom
crop, shadow), product-name caption. Also seeds admin user, 3 suppliers, sample POs and ~15
orders across all statuses so admin screens are alive.

- **Clock-relative timestamps:** seeded order/PO dates are generated **relative to seed time**
  (spread over the last 14 days) — deterministic in content/quantities, only the clock anchor
  moves — so the 30-day dashboard is never silently empty.
- **Idempotency (defined, not asserted):** products upserted by `slug`, users by `email`,
  suppliers by `name`; sample orders/POs are created **only when their collections are empty**;
  counters are set to `max(existing)+n` in one step instead of blind `$inc`. Test: "run twice →
  same collection counts, same order numbers".
- **Image check (the acceptance criterion):** per product, `1 ≤ images.length ≤ 5` and every
  `images[].src` exists on disk — not a bare file count.

## 10. Decisions log

Recorded in `docs/DECISIONS.md` (created with M1): cents-integers, gross pricing, denormalized
`filter` block recomputed in actions, custom cart store (no zustand), own session/crypto instead
of next-auth, listing JSON API + URL-as-state, mock payment auto-pays. Added after review:
stock model (decrement at `createOrder`, restock on cancel, no reservations — real transactions
on a single-node replica set), security parameters (Origin checks, 12 h cookie expiry, scrypt
N=2^15/r=8/p=1, login throttle), labels outside the web root (`data/labels/`), deployment
target (long-running Node server, `runtime='nodejs'`, prod needs `MONGODB_URI`), shipping
prices (4.90/12.90, free ≥ 100) and VAT rounding rule, MMS binary pinning + download cache +
`MONGOMS_SYSTEM_BINARY` fallback, English-code/German-URL rule with rewrites, no German
stemming in the text index, toolchain fallback rule (M1 task 1).
