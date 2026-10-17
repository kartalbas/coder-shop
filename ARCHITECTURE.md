# coder-shop — Architecture

Production-grade e-commerce system. Full-stack TypeScript, Next.js App Router, MongoDB via
Mongoose, no installed database required locally (mongodb-memory-server). UI language German,
currency CHF (de-CH), Swiss VAT 8.1 % included in prices.

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
| mongodb-memory-server | 11.3.0 | embedded mongod for dev/seed (persistent `./data/mongo`), throw-away for tests |
| vitest | 5.0.5 | unit/integration tests |
| @vitejs/plugin-react | 6.1.2 | React transform for vitest (component tests if needed) |
| eslint | 10.13.0 | linting, flat config (`eslint.config.mjs`) |
| eslint-config-next | 16.4.2 | Next lint rules |
| zod | 4.6.7 | validation of actions, API input, env |
| motion | 14.3.0 | Framer Motion (import from `motion/react`) |
| clsx | 2.1.1 | class composition |
| tailwind-merge | 3.7.0 | `cn()` helper |
| class-variance-authority | 0.7.1 | shadcn variants |
| lucide-react | 1.58.0 | icons |
| tw-animate-css | 1.4.0 | animation utilities for shadcn on Tailwind v4 |
| pdf-lib | 1.17.1 | generated PDF labels (mock provider) + packing slip |

Dev types: `@types/node` 26.6.5, `@types/react` 19.3.0, `@types/react-dom` 19.3.0.
Password hashing: `node:crypto` scrypt (no extra dependency). Sessions: HMAC-signed cookie
(`node:crypto`), httpOnly, SameSite=Lax.

## 2. Folder structure

```
public/products/            # generated SVG product images (seed output, gitignored content)
data/mongo/                 # persistent mongod dbPath (gitignored)
src/
  app/
    layout.tsx              # root: fonts, ThemeProvider, Toaster, <RouteTransition>
    globals.css             # Tailwind v4 @theme, light/dark tokens
    (storefront)/
      layout.tsx            # Header (mega-menu, search, cart badge) + CartDrawer + Footer
      page.tsx              # home
      produkte/page.tsx     # listing /produkte?typ=schuhe&marke=...&groesse=42&sort=...&seite=2
      produkt/[slug]/page.tsx
      warenkorb/page.tsx    # full cart page (drawer is global)
      checkout/page.tsx
      bestellung/[nummer]/page.tsx   # confirmation + status
    admin/
      layout.tsx            # session guard (server), sidebar
      login/page.tsx
      page.tsx              # dashboard
      produkte/page.tsx, produkte/[id]/page.tsx
      bestellungen/page.tsx, bestellungen/[id]/page.tsx
      verpacken/page.tsx, verpacken/[id]/page.tsx (+ druckansicht)
      einkauf/page.tsx, einkauf/[id]/page.tsx, lieferanten/page.tsx
    api/
      search/route.ts       # GET instant search JSON
      products/route.ts     # GET faceted listing JSON (client navigation data source)
      health/route.ts       # GET { ok } — also warms DB connection
      shipping/label/[orderId]/route.ts  # POST create label (admin)
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
  lib/
    db.ts                   # single connection helper (see §6)
    env.ts                  # zod-validated env access
    format.ts               # CHF de-CH, dates, weights
    pricing.ts              # gross/net VAT 8.1 %, totals
    stock.ts                # reservation/release, low-stock rule
    orders/state-machine.ts # transitions + validation + logging
    shipping/provider.ts    # ShippingProvider interface + factory
    shipping/ups.ts         # UpsShippingProvider (UPS REST)
    shipping/mock.ts        # MockUpsProvider (1Z…, pdf-lib label)
    search.ts               # builds Mongo query/aggregate for search + facets
    session.ts              # admin login/session cookie
    validations/            # zod schemas shared by actions + forms
    seed/
      seed.ts               # deterministic seed entry (npm run seed)
      catalog.ts            # deterministic product data generation (mulberry32 PRNG)
      svg.ts                # SVG image generator (silhouettes, colors, angles)
  stores/
    cart.ts                 # useSyncExternalStore store, localStorage-persisted
  hooks/
    use-debounce.ts, use-media-query.ts
  test/
    setup.ts                # globalSetup: throw-away mongod; per-file cleanup
vitest.config.ts  eslint.config.mjs  next.config.ts  components.json  postcss.config.mjs
```

## 3. Mongoose models (document-oriented)

All models: `{ versionKey: false }`, timestamps where useful. Money is **integer cents**
(`priceCents` etc.), gross (VAT 8.1 % included). Weights in **grams**.

### Product (`products`)
```ts
{
  slug: string            // unique
  name: string
  description: string
  typ: 'smartphone' | 'schuhe' | 'kleidung'
  brand: string
  priceCents: number      // base gross price
  images: [{ src: string, alt: string }]        // 1–5, /products/<slug>-<n>.svg
  featured: boolean
  collection?: string     // e.g. "Neuheiten", "Bestseller"
  filter: {               // denormalized facet source, derived from variants on save
    farben: string[]
    groessen: string[]    // EU sizes "36".."47" or XS..XXL
    speicher: number[]    // GB, smartphones only
    material: string[]    // kleidung only
  }
  variants: [{
    sku: string                     // unique across all products
    label: string                   // e.g. "42 / schwarz", "256 GB / titan"
    priceDeltaCents: number
    stock: number
    restockThreshold: number        // low-stock alert level
    weightGrams: number
    attributes: { farbe: string, groesse?: string, speicher?: number, material?: string }
  }]
  createdAt, updatedAt
}
```
Indexes:
- `{ slug: 1 }` unique
- `{ 'variants.sku': 1 }` unique
- `{ typ: 1, brand: 1 }`, `{ typ: 1, 'filter.groessen': 1 }`, `{ typ: 1, 'filter.speicher': 1 }`,
  `{ typ: 1, 'filter.farben': 1 }`, `{ typ: 1, 'filter.material': 1 }` — faceted filters
- `{ typ: 1, priceCents: 1 }`, `{ typ: 1, createdAt: -1 }` — sorting
- `{ featured: 1, typ: 1 }` — home page
- text index `{ name: 'text', description: 'text', brand: 'text' }` — search
- Listing queries hit compound filters + sort with `{ typ: 1, ...facet..., <sort>: 1 }` shapes;
  the aggregate for facets uses `$facet` over the typ-filtered set.

### Order (`orders`)
```ts
{
  nummer: string          // unique, "B-2026-000123" via atomic counter
  status: 'neu' | 'bezahlt' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'cancelled'
  statusLog: [{ status, at: Date, note?, by? }]
  kunde: { name, email, telefon, strasse, plz, ort, land }
  positionen: [{ productId, sku, name, variantLabel, menge, einzelpreisCents,
                 gesamtCents, weightGrams }]
  summen: { zwischensummeCents, versandCents, gesamtCents, mwstCents }
  versand: { methode: 'standard'|'express', carrier?: 'ups',
             trackingNumber?, labelPath?, paketGewichtGrams? }
  zahlung: { methode: 'mock', referenz: string, bezahltAm?: Date }
  createdAt, updatedAt
}
```
Indexes: `{ nummer: 1 }` unique, `{ status: 1, createdAt: -1 }`, `{ 'kunde.email': 1 }`.

### User (`users`) — admin login
`{ email (unique, lowercase), name, passwordHash (scrypt, salt embedded), role: 'admin' }`.
Seeded: `admin@codershop.ch` / `Admin!2026` (documented in README).

### Supplier (`suppliers`)
`{ name, email, telefon?, lieferzeitTage, aktiv }`.

### PurchaseOrder (`purchase_orders`)
```ts
{
  bestellNummer: string   // unique "E-2026-00042"
  supplierId: ObjectId
  status: 'draft' | 'ordered' | 'received'
  zeilen: [{ productId, sku, menge, einzelpreisCents, erhalten: number }]
  gesamtCents: number
  bestelltAm?, erhaltenAm?: Date
}
```
Indexes: `{ bestellNummer: 1 }` unique, `{ status: 1, createdAt: -1 }`.

### Counter (`counters`)
`{ _id: 'order'|'po', seq: number }` with `findOneAndUpdate({$inc})` for gap-free numbers.

## 4. Server actions and route handlers

Server actions (zod-validated, return `{ ok } | { error }`):
- `checkout.ts`: `createOrder(cart, customer, shippingMethod)` — validates stock, decrements
  variant stock atomically (`findOneAndUpdate` with `stock: { $gte: menge }` per item in a
  transaction-less multi-doc guard; on partial failure compensate), computes totals via
  `lib/pricing`, creates order `status: 'neu'`, mock payment → `bezahlt` immediately
  (confirmation page shows payment reference).
- `admin/products.ts`: `updateProduct`, `updateVariant` (price, stock, weight), `toggleFeatured`.
- `admin/orders.ts`: `transitionOrder(orderId, to, note)` — delegates to state machine.
- `admin/purchasing.ts`: `createSupplier`, `createPurchaseOrder`, `markOrdered`,
  `receivePurchaseOrder` — receiving increments `variant.stock` per line, sets `erhalten`.
- `admin/auth.ts`: `login`, `logout`.
- `admin/shipping.ts`: `createLabel(orderId)` — factory provider, stores tracking + label file
  under `public/labels/`, transitions order to `shipped`.

Route handlers:
- `GET /api/search?q=` → ≤8 hits `{ slug, name, typ, priceCents, image, variantHint }`
  (regex/text, `$limit`, used by instant search; debounced client-side).
- `GET /api/products?typ=&…&sort=&seite=` → same shape the server page renders, consumed by
  the client listing shell for instant facet/sort/page updates without server round-trip
  rendering (URL stays the source of truth via `router.replace`, `scroll:false`).
- `POST /api/shipping/label/[orderId]` → label creation (also callable as action).
- `GET /api/health` → `{ ok: true, db: 'memory-server' | 'external' }`.

## 5. Order state machine (`src/lib/orders/state-machine.ts`)

```
neu → bezahlt → picking → packed → shipped → delivered
cancelled reachable from: neu, bezahlt, picking   (not from packed/shipped/delivered)
```
- `canTransition(from, to): boolean` from an explicit adjacency map.
- `transition(order, to, { note, by })`: validates, sets `status`, appends
  `{ status, at: new Date(), note, by }` to `statusLog`; throws `IllegalTransitionError`
  otherwise. Idempotency: same-state transition rejected.
- Label creation is the canonical path into `shipped` (provider must succeed first).
- Cancelling from `bezahlt`/`picking` restocks the variants.
- Pure function over plain data → fully unit-tested (every edge of the graph).

## 6. Database lifecycle (mongodb-memory-server)

`src/lib/db.ts` — single `connectDB(): Promise<Mongoose>`:
1. `MONGODB_URI` set → `mongoose.connect(MONGODB_URI)` (production path).
2. Else start `MongoMemoryServer.create({ instance: { dbPath: path.resolve('data/mongo'),
   storageEngine: 'wiredTiger' } })` and connect to its URI. Cached on `globalThis`
   (`__mongoServer`, `__mongoose`) so Next dev HMR / multiple module instances share one mongod;
   `process.on('exit')` stops it. First request pays ~1 s startup; `/api/health` warms it.
3. Concurrent callers await the same promise (single-flight).

- **dev** (`npm run dev`): on-demand via helper; data persists in `./data/mongo` across restarts.
- **seed** (`npm run seed` → `tsx src/lib/seed/seed.ts`): same helper, `--fresh` drops the
  database first; script stops the server and exits 0.
- **build**: no DB access at build time. All DB-backed routes are `export const dynamic =
  'force-dynamic'` (or `revalidate = 0`); static shells (admin login, layout) prerender fine.
  `next build` must succeed with no mongod running — this is an acceptance check every milestone.
- **tests** (vitest): `globalSetup` starts a throw-away `MongoMemoryServer` (no dbPath, in-RAM),
  exports its URI as `MONGODB_URI` to workers; each test file cleans its collections in
  `afterEach`. Unit tests of pure lib logic need no DB.

## 7. Client/server split (SPA feel)

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
  `usePathname()` with `AnimatePresence` fade/slide (150–250 ms, respects
  `prefers-reduced-motion`); mega-menu opens on hover (desktop) / tap (mobile).
- **Mutation UX**: checkout and admin actions use `useActionState`/`useFormStatus` with
  optimistic UI where safe (cart, wishlist-free), toasts for feedback.

## 8. UX concept per page

Global: mobile-first, dark mode via `next-themes`-style class strategy (own tiny provider,
`prefers-color-scheme` default, toggle in header), visible focus rings, semantic landmarks,
German copy, CHF formatted `Intl.NumberFormat('de-CH', { style:'currency', currency:'CHF' })`.

- **Home** — full-bleed hero (headline, CTA, featured product collage with parallax float),
  category tiles (smartphones/schuhe/kleidung) with hover zoom, "Beliebte Produkte" rail
  (horizontal scroll-snap), featured collection band. Motion: staggered fade-up on load.
- **Header** — sticky, blur backdrop; logo, mega-menu (typ → brand/attribute columns + promo
  tile), instant search (debounce 200 ms, `⌘K`/`/` focus, arrow-key + Enter navigation,
  `role="combobox"`/`aria-expanded`), theme toggle, cart button with animated count badge.
- **Listing /produkte** — left facet sidebar (checkbox groups per typ: marke, größe, farbe,
  speicher, material; counts per facet), top bar (result count, sort select, mobile filter
  sheet), responsive product grid (2/3/4 cols), skeleton cards, empty state with reset action,
  numbered pagination + "Zeige 1–24 von 70". URL params: `typ, marke, groesse, farbe, speicher,
  material, sort, seite`.
- **Product page /produkt/[slug]** — breadcrumbs; gallery (main image + thumbnails, swipe via
  drag, click-to-zoom dialog, crossfade on variant color change); title, price (animated on
  variant change), variant pickers (farbe/groesse/speicher chips, disabled when out of stock),
  stock indicator (grün/gelb/rot text + dot), qty stepper, "In den Warenkorb" (opens drawer),
  weight/description accordion, related products (same typ+brand first), JSON-LD `Product` with
  offers per variant.
- **Cart drawer / /warenkorb** — drawer from right (sheet), line items with variant label, qty
  steppers (optimistic), subtotal, free-shipping progress bar, "Zur Kasse"; full page mirrors
  drawer for deep links.
- **Checkout** — single column, 3 anchored steps (Adresse → Versand → Zahlung), zod-validated
  client + server, mock payment (card form stub), summary sidebar sticky; success → confetti-
  light motion → redirect confirmation.
- **Bestellung/[nummer]** — big confirmation, status timeline (state machine steps), items,
  totals incl. VAT note "8,1 % MwSt. inbegriffen", tracking number once shipped.
- **Admin login** — centered card, demo credentials hint.
- **Admin dashboard** — KPI cards (Umsatz 30 Tage, offene Bestellungen, Lieferungen ausstehend),
  low-stock table (stock ≤ restockThreshold), recent orders, revenue sparkline (SVG, no chart lib).
- **Admin Produkte** — searchable table (debounced), inline stock edit, edit page with variant
  table (price delta, stock, weight, attributes), image preview strip, featured toggle.
- **Admin Bestellungen** — status filter tabs with counts, table, detail page with status
  timeline + allowed-transition buttons (server-validated), cancel with restock note.
- **Admin Verpacken** — queue of `picking`/`packed` orders; per order: pick list (sorted by
  shelf-ish sku), printable packing slip (`/verpacken/[id]/druckansicht`, `@media print`),
  computed parcel weight (Σ qty × weightGrams + packaging), "UPS-Etikett erstellen" →
  transitions to shipped, shows tracking + PDF link.
- **Admin Einkauf** — suppliers CRUD-lite, PO list with status chips; PO editor (add lines by
  SKU search, qty, cost); buttons "Bestellen" (draft→ordered) and "Wareneingang" (→received,
  increments stock, toast with delta summary).

## 9. Seed data (deterministic)

`catalog.ts` uses a seeded PRNG (mulberry32, fixed seed) — same 200 products every run:
70 smartphones (brands Apple/Samsung/Xiaomi/Google/OnePlus; storage 64–512 GB; colors),
70 shoes (Nike/Adidas/Puma/On/Running…; EU 36–47; colors), 60 clothing (Northface…; XS–XXL;
materials). Realistic German descriptions from template pools, CHF price ranges per typ,
variant stock 0–80 (a few at 0 and a few below threshold for alerts), weights per typ range.
`svg.ts` writes 1–5 distinct SVGs per product to `public/products/`: type silhouette
(phone/shoe/shirt path), variant color fill, angle/detail variation (rotation, zoom crop,
shadow), product-name caption. Also seeds admin user, 3 suppliers, sample POs and ~15 orders
across all statuses so admin screens are alive.

## 10. Decisions log

Recorded in DECISIONS.md (created with M1): cents-integers, gross pricing, denormalized
`filter` block, custom cart store (no zustand), own session/crypto instead of next-auth,
listing JSON API + URL-as-state, mock payment auto-pays.
