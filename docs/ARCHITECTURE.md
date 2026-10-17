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
| typescript | 6.0.3 | strict mode (7.0.2 had no stable release at scaffold time — fallback per toolchain gate, recorded in DECISIONS) |
| tailwindcss | 4.3.3 | styling (CSS-first config, `@theme`) |
| @tailwindcss/postcss | 4.3.3 | PostCSS plugin for Tailwind v4 |
| shadcn | 4.22.0 | CLI that vendors UI components into `src/components/ui` |
| mongoose | 9.11.2 | ODM, typed schemas, indexes |
| mongodb-memory-server | 11.3.0 | embedded **single-node replica set** (`MongoMemoryReplSet`) for dev/seed (persistent `./data/mongo`) and tests — real transactions (§6) |
| vitest | 5.0.5 | unit/integration tests |
| @playwright/test | 1.64.1 | end-to-end tests (Chromium only, §12) |
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
| pdf-lib | 1.17.1 | generated PDF labels (mock provider) + packing slip + invoice PDFs (#40) |
| qrcode | 1.5.4 | Swiss QR-bill QR code in the invoice PDF (#40) |

Dev types: `@types/node` **24.19.2** (pinned to the installed Node 24 runtime, not `latest`),
`@types/react` 19.3.0, `@types/react-dom` 19.3.0.
Password hashing: `node:crypto` scrypt with explicit params (§4). Sessions: HMAC-signed cookie
(`node:crypto`), httpOnly, SameSite=Lax, with expiry (§4).

**Toolchain gate (M1 task 1):** the scaffold task ends only when `next build` + `lint` + `vitest`
are green on these pins. If a combination does not build, fall back to the newest combination
that does and record the actual versions in `docs/DECISIONS.md` — this is why the repo runs
TypeScript 6.0.3 (no stable 7.x at scaffold time) against the table's original target.

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
public/products/            # generated product photos (content gitignored, .gitkeep kept)
data/mongo/                 # persistent mongod dbPath (gitignored)
data/labels/                # generated shipping label PDFs (gitignored; NOT under public/ — PII, §4)
data/invoices/              # generated invoice PDFs (gitignored; NOT under public/ — PII, §4, #40)
.cache/mongod/              # mongodb-memory-server binary download cache (gitignored)
scripts/
  seed/
    seed.ts                 # deterministic seed entry (npm run seed → tsx scripts/seed/seed.ts)
    catalog.ts              # deterministic product data generation (mulberry32 PRNG)
  images/
    generate.ts             # image pipeline entry (npm run images → tsx scripts/images/generate.ts)
    prompt.ts               # pure prompt/seed/view logic (unit-tested)
    api.ts                  # image API client (fetch, retry w/ backoff, b64/url → WebP via sharp)
src/
  proxy.ts                  # Next 16 Proxy (Node runtime): /admin/* admin-scope session gate,
                            # /konto/* customer-scope gate (#39) + real 404 for unknown
                            # /produkt/[slug] before any bytes stream (§4, #28)
  app/
    layout.tsx              # root: fonts, ThemeProvider, Toaster, <RouteTransition>, metadata (§2 site.ts)
    globals.css             # Tailwind v4 @theme, light/dark tokens, @media print (packing slip)
    not-found.tsx           # global German 404 (noindex) — used by every notFound()/proxy 404
    (storefront)/
      layout.tsx            # Header (mega-menu, search, cart badge) + CartDrawer + Footer
      page.tsx              # home
      products/page.tsx     # listing — public URL /produkte (rewrite)
      products/vergleichen/page.tsx  # smartphone comparison — public URL
                            # /produkte/vergleichen?slugs=… (#48)
      products/[slug]/page.tsx      # public URL /produkt/[slug]
      cart/page.tsx         # full cart page — public URL /warenkorb (drawer is global)
      checkout/page.tsx     # public URL /kasse (prefill + login/guest choice, #39)
      order/[number]/page.tsx      # confirmation + status — public URL /bestellung/[nummer]
      order/[number]/rechnung/route.ts  # GET invoice PDF behind the confirmation URL
                            # /bestellung/[nummer]/rechnung — same visibility rule as the
                            # order details (#40, §4)
      konto/                # customer portal (#39), guarded by the proxy + portal layout
        (auth)/             # public: anmelden, registrieren, passwort-vergessen,
                            # passwort-zuruecksetzen
        (portal)/           # session-guarded: layout (nav), page (overview),
                            # bestellungen (list+search+claim+reorder), adressen, profil,
                            # rechnungen (offene Rechnungen mit Fälligkeit/Überfällig, #40),
                            # wunschliste (gemerkte Produkte, #46)
    admin/                  # admin URLs stay English (internal)
      (auth)/login/page.tsx
      (panel)/              # session-guarded group (layout requires the admin session)
        layout.tsx          # sidebar + mobile sheet nav
        page.tsx            # dashboard
        products/page.tsx, products/[id]/page.tsx
        orders/page.tsx, orders/[id]/page.tsx
        packing/page.tsx, packing/[id]/page.tsx (+ print view)
        purchasing/page.tsx, purchasing/[id]/page.tsx, suppliers/page.tsx
        mails/page.tsx      # dev outbox: every mail the shop would have sent (#39/#44)
        invoices/page.tsx   # invoice list + filters (offen/überfällig/bezahlt), payment +
                            # reminder + credit-limit actions (#40)
        pickup/page.tsx     # pickup queue: bereitstellen, Code-Übergabe + Zahlung (#41)
        customers/page.tsx, customers/[id]/page.tsx  # customer list + detail (#43)
        discounts/page.tsx  # discount codes: create, activate/deactivate, usage stats (#45)
        reviews/page.tsx    # review moderation: approve, hide, answer (#47)
      labels/[orderId]/route.ts    # GET label PDF (session-guarded, §4)
      invoices/[orderId]/route.ts  # GET invoice PDF (session-guarded, §4, #40)
    api/
      search/route.ts       # GET instant search JSON
      products/route.ts     # GET faceted listing JSON (documented JSON API, §4)
      recently-viewed/route.ts  # GET products behind remembered slugs, newest first (#46)
      health/route.ts       # GET { ok } — also warms DB connection
  components/
    ui/                     # vendored shadcn components (kept canonical, knip-ignored, §13)
    storefront/             # named "storefront" (not "shop") — recorded deviation, DECISIONS
      header.tsx, mega-menu.tsx, search-instant.tsx, theme-toggle.tsx, footer.tsx
      cart-drawer.tsx, cart-button.tsx, cart-provider.tsx, cart-page-view.tsx, product-card.tsx
      listing-shell.tsx, filter-sidebar.tsx, sort-select.tsx, pagination.tsx, skeletons.tsx,
      empty-state.tsx, free-shipping-progress.tsx
      gallery.tsx, product-detail.tsx   # variant picker inlined in product-detail
      stock-indicator.tsx, related-products.tsx, checkout-form.tsx,
      product-image.tsx            # photo vs neutral placeholder (§11)
      breadcrumbs.tsx, json-ld.tsx, route-transition.tsx
      order-status-chain.tsx, order-access-form.tsx  # confirmation (#3, #32)
      account-nav.tsx, customer-login-form.tsx, register-form.tsx, password-reset-forms.tsx,
      claim-order-form.tsx, reorder-button.tsx, address-book.tsx, customer-password-form.tsx,
      account-logout-button.tsx,                     # customer portal (#39)
      discount-input.tsx,                            # code field with live feedback (#45)
      wishlist-heart.tsx, wishlist-sync.tsx, wishlist-merge-on-visit.tsx,
      wishlist-remove-button.tsx, local-store-hydrator.tsx,
      recently-viewed.tsx, restock-alert-form.tsx,    # wishlist + recently viewed +
      star-rating.tsx, review-form.tsx, review-section.tsx,  # reviews (#47)
      compare-toggle.tsx, compare-tray.tsx            # smartphone comparison (#48)
    admin/
      admin-nav.ts, sidebar.tsx, mobile-nav.tsx, login-form.tsx, password-form.tsx,
      order-status-badge.tsx, status-timeline.tsx, transition-buttons.tsx,
      product-search.tsx, product-core-form.tsx, variant-editor.tsx, image-editor.tsx,
      po-create-form.tsx, picker-dialog.tsx, # PO form + keyboard picker dialog (#42)
      po-status-actions.tsx, po-status-badge.tsx, supplier-form.tsx,
       revenue-sparkline.tsx, pack-list.tsx, label-actions.tsx,
       invoice-actions.tsx,         # payment / reminder / credit-limit forms (#40)
        customer-actions.tsx,        # block / notes / password-reset forms (#43)
         pickup-actions.tsx,          # mark-ready + handover (code, cash/card) forms (#41)
         discount-forms.tsx,          # create + activate/deactivate codes (#45)
         review-actions.tsx           # approve / hide / answer a review (#47)
  models/                   # mongoose schemas (pure shapes re-exported from src/lib, §2 purity)
    product.ts order.ts checkout-claim.ts user.ts supplier.ts purchase-order.ts counter.ts
    discount-code.ts        # marketing codes: percent/fixed, window, limits (#45)
    discount-usage.ts       # (code, customer) redemptions — unique _id enforces once-each (#45)
    password-reset.ts       # hashed one-hour reset tokens (TTL index, #39)
    mail-message.ts         # dev outbox messages (#39/#44)
    restock-alert.ts        # (sku, e-mail) back-in-stock subscriptions, notify-once (#46)
    review.ts               # verified-buyer reviews: pending/approved/hidden (#47)
  lib/                    # PURE domain logic — no I/O, no mongoose, no fs, no fetch
                          # (guard test: tests/lib-purity.test.ts)
    product-types.ts        # ProductType union (models re-export it)
    dto.ts                  # ProductDto/VariantDto types (server/search re-exports + maps)
    format.ts               # CHF de-CH, dates, weights
    dates.ts                # Swiss calendar days (Europe/Zurich): day keys, DST-safe bounds
    numbers.ts              # formatOrderNumber/formatPoNumber/formatPaymentReference
    pricing.ts              # gross VAT 8.1 %, totals, VAT rounding + copy, buyable price (§8 note)
    stock.ts                # pure stock rules: isLowStock, stockLevel, stockLabel
    facets.ts               # deriveFilter(variants) + ProductFilter (pure facet derivation, §3/§4)
    facet-order.ts          # natural facet value ordering (EU sizes, clothing sizes, storage)
    regex.ts                # escapeRegex (shared by search + SKU search)
    menu.ts                 # mega-menu categories/brands + PRODUCT_TYPE_LABELS (synced, tested)
    brands.ts               # CATALOG_BRANDS — single brand set (seed + mega-menu)
    collections.ts          # Neuheiten | Bestseller | Sale (seed, listing, home, menu)
    product-selection.ts    # variant dimensions/selection + color→photo-slot rule (#18/#19)
    site.ts                 # SITE_URL + absoluteUrl (metadata, JSON-LD)
    images.ts               # isPhotoSrc — photo vs placeholder rule (§11)
    orders/state-machine.ts # statuses, transitions + validation + logging (pure)
    orders/labels.ts        # German order status labels (UI copy only)
    purchasing/labels.ts    # PurchaseOrderStatus + German PO labels (#35)
    shipping/types.ts       # ShippingProvider interface, label result types
    shipping/weight.ts      # parcel weight = Σ qty×weight + PACKAGING_GRAMS (150 g constant)
    order-visibility.ts     # who may see full order PII (cookie/admin/owning account, #39)
    payments.ts             # PaymentMethodName ('mock' | 'invoice' | 'pickup') + labels,
                            # pickup payment types (cash/card) (#40/#41)
    store.ts                # pickup store address + opening hours (single source, #41)
    discounts.ts            # pure discount math + validity window (#45)
    reviews.ts              # pure review rules: statuses, purchase rule, rating
                            # aggregation + distribution (#47)
    compare.ts              # comparison rows + difference detection (#48)
    invoices.ts             # pure invoice rules: due date, open amount, overdue, credit
                            # default, ISO-11649 QRR reference + SPC QR payload (#40)
    mail-templates.ts       # German e-mail templates as pure functions (#39/#44),
                            # incl. invoice reminders (#40)
    validations/            # zod schemas shared by actions + forms (checkout, listing,
                            # product, purchasing, account (#39), common: objectIdSchema)
  server/                   # ALL I/O: db, session, queries, providers, actions
    db.ts                   # single connection helper (see §6)
    env.ts                  # zod-validated env access (MONGODB_URI, UPS_*, SMTP_*, SESSION_SECRET optional)
    numbers.ts              # mintNumber(counterId, format) — shared order/PO number minting
    session-token.ts        # pure HMAC cookie sign/verify (scope: admin | customer, #39)
    session.ts              # admin + customer login/session (scrypt, throttle, scoped cookies)
    customers.ts            # register, password reset, address book, claim order (#39)
    customers-admin.ts      # customer list/detail, block, notes, admin password reset (#43)
    account.ts              # portal queries: order list, reorder lines (#39)
    mail.ts                 # sendMail behind a MailTransport interface: dev outbox
                            # collection (/admin/mails) or nodemailer SMTP (#39/#44)
    password.ts             # scrypt hash/verify (self-describing format)
    limiter.ts              # token bucket (scrypt login concurrency guard)
    rate-limit.ts           # checkout rate limit (per client)
    secure-path.ts          # resolveInsideDir — path containment (label download)
    order-access.ts         # per-order HMAC access cookie + e-mail verification (#3)
    checkout.ts             # createOrderCore (transaction, idempotency claim, price check,
                            # invoice eligibility + credit check, #40; discount code check +
                            # redemption inside the transaction, #45)
    discounts.ts            # checkDiscountCore / redeemDiscount (conditional writes in the
                            # checkout txn) + admin create/toggle/list with usage stats (#45)
    invoices.ts             # invoice cores: lists (admin/portal), credit usage/limits,
                            # recordInvoicePaymentCore, sendInvoiceReminderCore,
                            # getInvoiceFileCore (transaction + conditional writes, #40)
    pickup.ts               # pickup cores: code generation, queue, markPickupReadyCore,
                            # handoverPickupCore (code check + payment in one txn, #41)
    invoices-pdf.ts         # invoice PDF with Swiss QR-bill section (pdf-lib + qrcode, #40)
    orders.ts               # customer confirmation lookup (getOrderByNumber)
    orders-admin.ts         # listOrders, transitionOrderCore (conditional write + restock)
    products-admin.ts       # updateProductCore/updateVariantCore/toggleFeaturedCore (§3 rule)
    purchasing.ts           # supplier + PO cores (create/markOrdered/receive, transaction),
                            # picker searches: variants by sku/name/brand + suppliers (#42)
    dashboard.ts            # revenue series, open counts, low stock, recent orders
    search.ts               # Mongo query/aggregate builders + toProductDto() shared DTO mapper
    wishlist.ts             # account wishlist: sync (merge/replace), list, remove (#46)
    restock-alerts.ts       # subscribe + notifyRestockedCore (goods receipt / cancel
                            # restock → one mail per waiting address, #46)
    reviews.ts              # review cores: submit (buyer check), lists, moderation,
                            # answer, denormalized product rating recompute (#47)
    shipping/provider.ts    # factory (env-driven)
    shipping/ups.ts         # UpsShippingProvider (UPS REST, token cache, §4)
    shipping/mock.ts        # MockUpsProvider (1Z…, pdf-lib label → data/labels/)
    shipping/label.ts       # createLabelCore + getLabelFileCore (packed-only, idempotent)
    actions/
      checkout.ts           # thin action wrapper → createOrderCore (transaction, + userId #39)
      discounts.ts          # validateDiscountAction — live feedback for the code field (#45)
      order-access.ts       # verifyOrderEmailAction (#3)
      account.ts            # register/login/logout, password reset, claim, addresses,
                            # reorder, change password (#39)
      admin/products.ts     # updateProduct, updateVariant, toggleFeatured → *Core fns
      admin/orders.ts       # transitionOrder → transitionOrderCore
      admin/purchasing.ts   # createSupplier, createPurchaseOrder, markOrdered,
                            # receivePurchaseOrder → *Core fns (transaction);
                            # searchSku/searchSupplier actions for the picker (#42)
      admin/auth.ts         # login/logout → loginCore (testable without cookies())
      admin/account.ts      # changePassword → changePasswordCore
      admin/shipping.ts     # createLabel → createLabelCore
      admin/invoices.ts     # recordInvoicePayment, sendInvoiceReminder, setCreditLimit
      admin/customers.ts    # setBlocked, setNotes, adminResetPassword → *Core fns (#43)
                            # → *Core fns (#40)
      admin/pickup.ts       # markPickupReady, handoverPickup → *Core fns (#41)
      admin/discounts.ts    # createDiscount, setDiscountActive → *Core fns (#45)
      admin/reviews.ts      # setReviewStatus, replyToReview → *Core fns (#47)
      wishlist.ts           # syncWishlistAction (merge/replace), removeWishlistItemAction (#46)
      restock-alerts.ts     # subscribeRestockAlertAction (#46)
      reviews.ts            # submitReviewAction (customer session + purchase) (#47)
  stores/
    cart.ts                 # useSyncExternalStore store, localStorage-persisted
    wishlist.ts             # local wishlist (newest-first slugs), synced to the account (#46)
    recently-viewed.ts      # last viewed slugs, local to the browser (#46)
    compare.ts              # up to 4 smartphone slugs to compare, local (#48)
  hooks/
    use-debounce.ts
  test/
    setup.ts                # globalSetup: throw-away MongoMemoryReplSet (§6)
    db.ts                   # connectTestDB/clearCollections/disconnectTestDB helpers
tests/                      # integration + unit tests (throw-away replica set) + e2e/ (Playwright, §12)
vitest.config.ts  eslint.config.mjs  next.config.ts  knip.json  components.json  postcss.config.mjs
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
  images: [{ src: string, alt: string }]        // 1–5 slots, /products/<slug>-<n>.webp
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
- No text index: search is a regex-escaped literal prefix on `name`/`brand` (§4) — enough at
  200 docs, so the write-time cost of a text index is not paid (recorded in DECISIONS)
- Listing queries hit compound filters + sort with `{ type: 1, ...facet..., <sort>: 1 }` shapes;
  **every sort appends `_id: 1` as tiebreaker** (stable pagination) and `page` is clamped to
  `[1, ceil(total/pageSize)]`. The aggregate for facets uses `$facet` over the type-filtered set.

### Order (`orders`)
```ts
{
  orderNumber: string     // unique, "B-2026-000123" via atomic counter
  status: 'new' | 'paid' | 'picking' | 'packed' | 'shipped' | 'delivered'
          | 'ready' | 'picked_up' | 'cancelled'
  statusLog: [{ status, at: Date, note?, by? }]
  userId?: ObjectId         // owning customer account (ordered logged-in or claimed, #39)
  customer: { name, email, phone, street, postalCode, city, country }
  lines: [{ productId, sku, name, variantLabel, qty, unitPriceCents,
            totalCents, weightGrams }]
  totals: { subtotalCents, shippingCents, totalCents, vatCents }
  shipping: { method: 'standard'|'express'|'pickup', carrier?: 'ups',
              trackingNumber?, labelPath?, parcelWeightGrams?,
              pickup?: { code, readyAt?, pickedUpAt?, paymentType?: 'cash'|'card' } }
  payment: { method: 'mock' | 'invoice' | 'pickup', reference: string, paidAt?: Date,
             invoice?: { dueAt, paidCents, qrReference, reminder1At?, reminder2At? } }
  discount?: { code, cents }   // applied discount code + booked reduction (#45)
  createdAt, updatedAt
}
```
`payment.invoice` (issue #40) carries the invoice bookkeeping: open amount is
`totals.totalCents − invoice.paidCents`, overdue once `dueAt` passed, reminder levels dated
so the 2nd cannot precede the 1st. `shipping.pickup` (issue #41) carries the handover code
(6 unambiguous characters) and how the on-site payment was taken.
Indexes: `{ orderNumber: 1 }` unique, `{ status: 1, createdAt: -1 }`, `{ 'customer.email': 1 }`,
`{ userId: 1, createdAt: -1 }`, `{ 'payment.method': 1, 'payment.invoice.dueAt': 1 }`.

### User (`users`) — admin login and customer accounts (#39)
`{ email (unique, lowercase), name, passwordHash, role: 'admin' | 'customer',
sessionsInvalidBefore?, addresses: [{ label, street, postalCode, city, country,
kind: 'shipping'|'billing', isDefault }], creditLimitCents?, blocked?, notes?,
wishlist: string[] }` —
`creditLimitCents` (personal invoice credit, #40; unset = shop default
`DEFAULT_CREDIT_LIMIT_CENTS`); `blocked` refuses customer login (issue #43, revealed
only with the correct password) and `notes` is the admin's internal remark;
`wishlist` (issue #46) is the account copy of the browser wishlist: product slugs,
newest first, capped at 100, only products that still exist;
`passwordHash` format
`scrypt$N$r$p$salt$hash` with explicit params (§4). Customers carry the address book
(one default per kind); admins never have addresses.
Seeded: `admin@codershop.ch` (password via `ADMIN_PASSWORD`, issue #4).

### PasswordReset (`password_resets`, #39)
`_id` is the SHA-256 of the random link token (the plain token is never stored),
`{ userId, expiresAt (1 h, TTL index), usedAt? }` — single-use reset links.

### MailMessage (`mail_messages`, #39/#44)
Dev outbox: `{ to, subject, html, text, sentAt }` — every mail the shop would send.

### RestockAlert (`restock_alerts`, #46)
`_id` is `sku|lower-case-email`, so double subscriptions are idempotent;
`{ sku, email, productSlug, variantLabel, createdAt, notifiedAt? }` — `notifiedAt` is
stamped when the back-in-stock mail goes out, so each address is notified at most once
per sell-out. Index `{ sku: 1, notifiedAt: 1 }`.

### Review (`reviews`, #47)
One document per (product, buyer) — the unique `{ productId: 1, userId: 1 }` index is
the race-safe "one review per purchase" guarantee;
`{ productId, userId, authorName, rating (1–5), title?, body, status:
'pending'|'approved'|'hidden', adminReply?, adminRepliedAt?, createdAt, updatedAt }`.
Only customers with a purchased order for the product may submit (pure rule
`countsAsPurchase` in `src/lib/reviews.ts`); new reviews are `pending` and only
`approved` ones are public. Indexes `{ productId: 1, status: 1 }`,
`{ status: 1, createdAt: -1 }`. The approved aggregate is denormalized onto the
product as `rating: { average, count }` (recomputed on approve/hide) — cards, the
`sort=rating` listing order (`{ type: 1, "rating.average": -1 }`) and the JSON-LD
`AggregateRating` never touch the reviews collection.

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

### DiscountCode (`discount_codes`, #45)
`{ code (unique, upper-case), description?, kind: 'percent'|'fixed', percent?, amountCents?,
minOrderCents, validFrom?, validTo?, usageLimit?, usedCount, perCustomerOnce, active }` —
`usedCount` is incremented by a **conditional** `$inc` inside the checkout transaction
(`usedCount < usageLimit` guard), so a race cannot exceed the limit.

### DiscountUsage (`discount_usages`, #45)
One document per (code, customer) redemption: `_id` is `code|customerKey`
(customerKey = userId or lower-case e-mail), so the unique `_id` enforces
"once per customer" inside the transaction; the collection doubles as the
per-code usage statistic (distinct customers on the admin page).

## 4. Server functions, actions and route handlers

Every action is a thin wrapper over a pure-ish **core function** in `src/server` (B1):
`createOrderCore`, `transitionOrderCore`, `loginCore`, `createLabelCore`,
`receivePurchaseOrderCore`, `updateVariantCore` … Core functions take plain data, return typed
results and are covered by Vitest integration tests against the real replica set.

- `createOrderCore(cart, customer, shippingMethod)` — validates, then runs **one MongoDB
  transaction** (single-node replica set, §6): re-check stock, decrement each variant with
  `findOneAndUpdate({ variants: { $elemMatch: { sku, stock: { $gte: qty } } } })` — the guard
  and the decrement must hit the **same** array element (`$elemMatch`, not independent dotted
  conditions; QA regression test in `tests/create-order.test.ts`), mint `orderNumber` from the
  counter, insert the order `status: 'new'`, mock payment → `paid` immediately. Any failure
  aborts the transaction — **no compensation scheme** (removed; the transaction is the
  rollback). Each line carries `expectedUnitPriceCents` (the price the checkout displayed);
  if the database price differs, the order is refused with `reason: 'price_changed'` and the
  current prices, so the customer is never charged other than what was shown (issue #12).
  Stock model decision (docs/DECISIONS.md): decrement at `createOrder`, restock on
  cancel — **no reservations**; `lib/stock.ts` stays pure (predicates only), the DB loop lives
  here.
- Discount codes (issue #45, `src/server/discounts.ts`): an optional `discountCode` on the
  checkout payload is normalized (trim + upper-case, part of the #15 idempotency fingerprint)
  and checked **inside the transaction** against the DB subtotal — window/active, minimum
  order, usage limit, once-per-customer; `redeemDiscount` then books the redemption with a
  conditional `$inc` (`usedCount < usageLimit`) and the unique usage document, so a race
  loser aborts the whole order. The reduction lowers the taxable gross: VAT is computed over
  the discounted total (`computeTotals(items, method, discountCents)`). A rejected code is a
  clean user error (claim released, nothing written). Shown on cart, checkout, confirmation,
  invoice PDF and admin order detail; managed under `/admin/discounts`.
- `transitionOrderCore(orderId, to, note, by)` — delegates to the state machine; cancel from
  `new`/`paid`/`picking`/`ready` restocks **in the same transaction** (§5). The order's
  `payment.method` and `shipping.method` are part of the transition context (§5, #40/#41).
- Pickup cores (issue #41, `src/server/pickup.ts`): `markPickupReadyCore(orderId, by)` —
  `new`/`picking → ready` (conditional on the loaded status, stamps `pickup.readyAt`);
  `handoverPickupCore(orderId, code, paymentType, by)` — the code the customer shows must
  match, then `ready → picked_up` (`viaPickupHandover`) **and** the payment
  (`payment.paidAt` if still unpaid, `paymentType`) are recorded in one transaction.
  `listPickupQueueCore` is the admin queue; the packing queue excludes pickup orders.
- Invoice cores (issue #40, `src/server/invoices.ts`): `recordInvoicePaymentCore(orderId,
  amountCents, by)` — partial payments up to the open balance, conditional on the loaded
  state; settling a still-`new` order moves it to `paid` through the state machine
  (`viaInvoicePayment`). `sendInvoiceReminderCore(orderId, level)` — only overdue open
  invoices, level 2 only after level 1, each once (conditional `$set` on the empty field),
  mail to the dev outbox. `getInvoiceCreditUsageCents` / `getCreditLimitCents` — the credit
  check `createOrderCore` re-evaluates **inside the transaction**; `setCreditLimitCore` is
  the admin knob. `getInvoiceFileCore(orderNumber)` — renders the QR-bill PDF on demand into
  `data/invoices/` (outside the web root, path containment via `resolveInsideDir`).
- `receivePurchaseOrderCore(poId)` — increments `variant.stock` per line and sets `received`
  in one transaction.
- `updateProductCore` / `updateVariantCore` / `toggleFeaturedCore` — every update touching
  variants recomputes `filter` via `deriveFilter` (§3 rule). Writes are atomic `$set`s of the
  edited fields only (never a whole-document save), so concurrent stock changes are never
  clobbered (issue #13): a variant save that leaves `stock` at the loaded `expectedStock` does
  not touch `stock` at all; an explicit stock edit is applied conditionally on the variant
  still having `expectedStock` and refused with a conflict error otherwise.
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
  on `name`/`brand` (enough at 200 docs; no raw regex → no injection/ReDoS).
- `GET /api/products?type=&brand=&size=&color=&storage=&material=&sort=&page=` → the exact DTO
  the server page renders, produced by the shared `toProductDto()` mapper in `src/server/search.ts`
  (ObjectId→string, Date→ISO, `filter` shape) so client and server never hydrate different
  shapes. Consumed by the client listing shell (URL stays the source of truth via
  `router.replace`, `scroll:false`). Sort values: `price-asc | price-desc | newest`.
- `GET /admin/labels/[orderId]` → serves the label PDF (`Content-Type: application/pdf`)
  **behind the admin session guard** — the only way to read a label.
- `GET /admin/invoices/[orderId]` → invoice PDF behind the admin session guard (#40).
- `GET /bestellung/[nummer]/rechnung` → the same invoice PDF behind the **order visibility
  rule** (`mayViewOrderDetails`: access cookie, verified e-mail, owning account or admin,
  #3/#40) — strangers are redirected back to the confirmation.
- `GET /api/health` → `{ ok: true, db: 'memory-server' | 'external' }`.

**Admin security (recorded in docs/DECISIONS.md):**
1. **Origin check:** every state-changing operation goes through a Server Action, for which
   Next enforces the same-origin check itself (forged `Origin` → 400). There are deliberately
   no custom state-changing route handlers (the former `POST /api/shipping/label/[orderId]`
   had no caller and was removed, issue #34 — label creation is the action only).
2. **Session cookie:** payload `{ userId, exp, scope }` (admin 12 h; customer 30 d, issue
   #39), signature covers `exp`, verified with `crypto.timingSafeEqual`; a leaked cookie
   expires. `SESSION_SECRET` is required (and ≥ 32 chars) in production — no source-code
   fallback; outside production the secret is random per process. A session only counts for
   a user that still exists (DB check after the signature check) **and whose role matches
   the token's scope** — separate cookies `admin_session` / `customer_session`, so neither
   credential works in the other area; the login check itself is role-scoped too.
3. **scrypt params:** N=2^15, r=8, p=1, 16-byte random salt, 32-byte key; stored as
   `scrypt$N$r$p$salt$hash` so params are self-describing.
4. **Login throttle:** in-memory failed-attempt counters per **account** (cannot be rotated
   with headers) and per IP+account; `X-Forwarded-For` is only used when
   `TRUST_PROXY_HEADERS=true` (then the last entry — the address the own proxy saw),
   otherwise all requests share one IP bucket. scrypt verifications run through a
   limiter (2 parallel, queue 8, then a busy error) so parallel logins cannot exhaust
   the server — acceptable for this single-process app.

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
new → picking                                   (invoice/pickup orders only, #40/#41)
new/picking → ready → picked_up                 (pickup orders only, #41 — store collection;
                                                 the handover records the payment)
cancelled reachable from: new, paid, picking, ready   (not from packed/shipped/delivered)
```
Pickup orders never enter `packed`/`shipped`/`delivered`, parcel orders never enter
`ready`/`picked_up` — the shipping method in the transition context separates the chains.
- `canTransition(from, to, ctx)` from an explicit adjacency map; the context carries
  `viaLabel`, `viaInvoicePayment` and the order's `paymentMethod`. `new → picking` is legal
  **only for invoice orders**; `new → paid` of an invoice order is legal **only** via
  `viaInvoicePayment` (the money is recorded on the invoice, not by the status buttons).
  `allowedTransitions(from, { paymentMethod })` hides exactly those from the admin buttons.
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
  dbPath), exports its URI to workers; the pool runs **serially** (`maxWorkers: 1` +
  `fileParallelism: false` — Vitest 5 replaced `poolOptions.threads.singleThread`, see
  DECISIONS) so the shared mongod is never queried while another file wipes collections —
  cheap at this scale and keeps the "npm test green" gate non-flaky. Unit tests of pure lib
  logic need no DB.
- **e2e** (Playwright): `tests/e2e/` runs against a **production build** on its own port with
  a freshly seeded throw-away replica set (§12) — never against `data/mongo`.
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

Global: mobile-first, dark mode via the `next-themes` package (class strategy,
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
  success → confetti-light motion → redirect confirmation. Issue #39: logged-in customers
  start prefilled from profile + default shipping address and their orders carry `userId`;
  guests see an "Anmelden / Konto erstellen / als Gast bestellen" banner.
- **Konto /konto (customer portal, #39)** — proxy-guarded (customer-scope cookie) with a
  login/register/forgot-password/reset area under `/konto/(auth)`. Portal: overview,
  Bestellungen (newest first, search by number/article, guest-order claim by e-mail,
  „Erneut bestellen" with today's prices/stock), Adressen (address book, one default per
  kind), Profil (data, password change, logout). E-mail + password are the identity; the
  order confirmation page shows full PII to the owning account too (`order-visibility.ts`).
- **Bestellung/[nummer]** — big confirmation, status timeline (state machine steps), items,
  totals incl. VAT note "8,1 % MwSt. inbegriffen", tracking number once shipped. **Buyer-only
  PII:** order numbers are sequential/guessable, so address/e-mail/phone/items/tracking are
  rendered only for a browser with the per-order access cookie (HMAC cookie set at checkout,
  `src/server/order-access.ts`), after confirming the order's e-mail (throttled form), for
  the owning customer account (linked `userId` or same e-mail, #39 — pure rule in
  `src/lib/order-visibility.ts`), or for a signed-in admin; strangers get only the number,
  status and the confirmation form.
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
- **Admin Mails (#39/#44)** — the dev outbox: every mail the shop would have sent
  (registration, password reset, …) listed newest first with the plain-text body.

## 9. Seed data (deterministic, idempotent, clock-relative)

`scripts/seed/catalog.ts` uses a seeded PRNG (mulberry32, fixed seed) — same 200 products every
run: 70 smartphones (brands Apple/Samsung/Xiaomi/Google/OnePlus; storage 64–512 GB; colors),
70 shoes (Nike/Adidas/Puma/On/Running…; EU 36–47; colors), 60 clothing (Northface…; XS–XXL;
materials). Realistic German descriptions from template pools, CHF price ranges per type,
variant stock 0–80 (a few at 0 and a few below threshold for alerts), weights per type range.
The seed records 1–5 image slots per product with their final photo paths
(`/products/<slug>-<n>.webp`) but writes no image files itself — the photo pipeline (§11)
owns `public/products/` (issue #29). Also seeds admin user, 3 suppliers, sample POs and ~15
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
`MONGOMS_SYSTEM_BINARY` fallback, English-code/German-URL rule with rewrites, no text index
(regex prefix search instead), toolchain fallback rule (M1 task 1).

## 11. Image pipeline (M6 — product photos)

Photorealistic studio product photos fill the seed's image slots; until a slot's file
exists, the storefront shows the neutral placeholder. Generator: `scripts/images/generate.ts` (`npm run images`, `--limit N`
caps generations per run; resumable, stop/restart anytime).

- **API:** `POST http://192.168.10.210:8080/v1/images/generations` (OpenAI images API shape:
  `{ prompt, size: "768x768", seed }`, `Authorization: Bearer $LLAMA_API_KEY` from the
  environment; the key is only required when a slot actually needs generation — a pure
  skip/repair run works without it, otherwise missing key → clear error, exit 1).
  Response `data[0].b64_json` (or `url`,
  fetched) → decoded, normalized to **WebP** via sharp, written to
  `public/products/<slug>-<n>.webp` (n = 1–5), then the path + German alt
  (`"<name> – Front-/Seiten-/Rück-/Detail-/Lifestyle-Ansicht"`) is recorded on the product
  document (`images[n].src/.alt`) — generated files are never committed.
- **Prompt (one per image, pure in `prompt.ts`, unit-tested):** product type noun, variant
  colour (image n uses `variants[n % variants.length]`, mirroring the seed), material
  (clothing), view = image index (1 front, 2 side, 3 back, 4 detail, 5 lifestyle), "studio
  product photography, soft studio lighting, clean neutral background, photorealistic",
  negatives "no logos, no text, no watermark". **No brand names or trademarks** in prompts.
  **Seed:** deterministic 32-bit FNV-1a hash of `<slug>-<n>` → restarts reproduce images.
- **Resumability:** a slot whose `<slug>-<n>.<webp|jpg|jpeg|png>` file exists on disk is
  never re-generated; if the document path drifted from the file on disk it is repaired.
  `--limit N` counts only actual generations (skips are free).
- **Failure handling:** retries with exponential backoff (1 s/2 s/4 s, 4 attempts total) on
  network errors, 429 and 5xx; other 4xx fail fast with the response body excerpt. One
  progress line per image (`[done/total] <file> <view>/<colour> ✓|✗ …`); exit 0 iff no
  generation failed, 1 otherwise.
- **Storefront rule:** `components/storefront/product-image.tsx` renders `<img>` when
  `images[].src` is a photo extension (`.webp/.jpg/.jpeg/.png/.avif`), otherwise a neutral
  placeholder (muted panel + icon); a photo path whose file does not load yet (the normal
  state until `npm run images` fills the slot) falls back to the same placeholder via
  `onError`. Used by product cards, gallery (main/thumbs/zoom), instant search and the cart
  drawer.
- **Seed invariant (issue #14):** every seed write is `$setOnInsert` — products (incl.
  `images`), the admin user and suppliers are only ever created, never updated. Sold
  stock, edited prices/texts and recorded photo paths survive any re-run; a drifted image
  document is repaired by the next `npm run images` (skip pass). `--fresh` is the only
  reset.

## 12. End-to-end tests (Playwright, `npm run test:e2e`)

Chromium only (`@playwright/test` 1.64.1, `tests/e2e/playwright.config.ts`, single worker).
`global-setup.ts` refuses to run without a production build (`.next/BUILD_ID`), then:
starts a throw-away `MongoMemoryReplSet`, seeds it fresh (`seed.ts --fresh` with
`MONGODB_URI` pointed at it — `data/mongo` is never touched), spawns `next start` on its own
port (`E2E_PORT`, default 3100, host 127.0.0.1), waits for `/api/health` and tears everything
down afterwards.

Specs (the three required journeys):
- `storefront.spec.ts` — browse home → listing with faceted filter → product page (gallery
  thumbnail navigation, variant picker updates price) → add to cart (drawer) → cart page →
  checkout (address + shipping + mock payment) → confirmation URL with `B-YYYY-######`
  order number, "Bezahlt" and the VAT note.
- `admin-shipping.spec.ts` — admin login → first `paid` order → `picking` → `packed` →
  UPS label via the **mock provider** → `shipped` with a `1Z…` tracking number, which is then
  asserted on the customer confirmation page.
- `purchasing.spec.ts` — open the seeded `ordered` PO → read its lines → "Wareneingang" →
  every line's variant stock increased by exactly the ordered quantity (stock read through
  the admin product search page).

Run order for the full gate: `npm run build && npm run test:e2e` (the build is a hard
prerequisite; `npm test` and `npm run lint` are independent).

## 13. Code quality (knip)

`knip` (exact-pinned devDependency, `knip.json`, `npm run knip`) enforces "no dead code":
nothing may be exported without a second-file consumer, no file may be unreachable, no
dependency unused. Exceptions: `src/components/ui/**` is vendored shadcn code kept in
canonical upstream shape on purpose (DECISIONS #34). CI-equivalent local checks:
`npm run knip && npm run lint && npm test && npm run test:e2e`.
