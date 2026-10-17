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

## Next

M3 — Cart, checkout, orders.
