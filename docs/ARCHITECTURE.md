# coder-shop — Architecture

Production-grade e-commerce system. Full-stack TypeScript, Next.js App Router, MongoDB via
Mongoose, no installed database required locally (mongodb-memory-server). UI language German,
currency CHF (de-CH), Swiss VAT included in prices (rate is shop configuration, #64).

**Language rule (one language for code):** all identifiers, statuses, model fields, sort values,
query params and route-segment code names are **English** (`new`, `paid`, `picking`, `packed`,
`shipped`, `delivered`, `cancelled`; `customer`, `lines`, `totals`…) — **routes and public URLs
too** (`/account/profile`, `/products`, `/cart`, `/checkout`, `/orders/…`, #63) — the
storefront serves them behind a language prefix (`/fr/account/profile`, #58), which never
changes the English path. German appears
**only** as the base language of the content (UI copy from the translation table, #58); the
former German URLs answer a permanent 308 redirect to their English counterparts via
`redirects()` in `next.config.ts` (§7).

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
  proxy.ts                  # Next 16 Proxy (Node runtime): language prefix for every
                            # storefront path (#58: resolve → 307 or lang cookie, gates on
                            # the stripped path), /admin/* admin-scope session gate,
                            # /account/* customer-scope gate (#39) + real 404 for unknown
                            # /products/[slug] before any bytes stream (§4, #28, #63)
  app/
    fonts.ts                # Geist font init shared by the two root layouts (#58)
    site-metadata.ts        # metadata base shared by the two root layouts (#58)
    globals.css             # Tailwind v4 @theme, light/dark tokens, @media print (packing slip)
    not-found.tsx           # German 404 (noindex) behind the internal /_not-found route —
                            # the proxy's real-404 rewrite target for unknown products (#28)
    [lang]/                 # storefront under the language prefix (#58): /de/products,
                            # /fr/account/profile — the path itself stays English (#63);
                            # generateStaticParams from the seeded language codes
      layout.tsx            # storefront root layout: fonts, ThemeProvider, Toaster,
                            # <RouteTransition>, <html lang>, per-language metadata +
                            # hreflang alternates from the proxy's x-localized-path header
      not-found.tsx         # localized 404 boundary (links to /{lang} and /{lang}/products)
      (storefront)/
        layout.tsx          # Header (mega-menu, search, language switcher, cart badge)
                            # + CartDrawer + Footer
        page.tsx            # home
        products/page.tsx   # listing — public URL /{lang}/products (#63, #58)
        products/compare/page.tsx   # smartphone comparison —
                            # /{lang}/products/compare?slugs=… (#48)
        products/[slug]/page.tsx    # product detail — /{lang}/products/[slug]
        cart/page.tsx       # full cart page — /{lang}/cart (drawer is global)
        checkout/page.tsx   # /{lang}/checkout (prefill + login/guest choice, #39)
        orders/[number]/page.tsx    # confirmation + status — /{lang}/orders/[number]
        orders/[number]/invoice/route.ts  # GET invoice PDF behind /{lang}/orders/[number]/invoice
                            # — same visibility rule as the order details (#40, §4)
        account/            # customer portal (#39), guarded by the proxy + portal layout
          (auth)/           # public: login, register, forgot-password, reset-password
          (portal)/         # session-guarded: layout (nav), page (overview),
                            # orders (list+search+claim+reorder), addresses, profile,
                            # invoices (offene Rechnungen mit Fälligkeit/Überfällig, #40),
                            # wishlist (gemerkte Produkte, #46)
    admin/                  # admin URLs stay English and prefix-free (internal)
      layout.tsx            # admin root layout: same shell, <html lang="de">, noindex
      not-found.tsx         # admin 404 boundary
      (auth)/login/page.tsx
      (panel)/              # session-guarded group (layout requires the admin session)
        layout.tsx          # sidebar + mobile sheet nav
        page.tsx            # dashboard
        products/page.tsx, products/[id]/page.tsx
        orders/page.tsx, orders/[id]/page.tsx
        packing/page.tsx, packing/[id]/page.tsx (+ print view)
        purchasing/page.tsx, purchasing/[id]/page.tsx, suppliers/page.tsx
        stock-units/page.tsx  # serial ledger (#62): every unit of a serial-tracked type —
                            # serial, status, order, PO number linking to the purchase
                            # order, per-unit history; search by serial or SKU
        mails/page.tsx      # dev outbox: every mail the shop would have sent (#39/#44)
        invoices/page.tsx   # invoice list + filters (offen/überfällig/bezahlt), payment +
                            # reminder + credit-limit actions (#40)
        pickup/page.tsx     # pickup queue: bereitstellen, Code-Übergabe + Zahlung (#41)
        customers/page.tsx, customers/[id]/page.tsx  # customer list + detail (#43)
        discounts/page.tsx  # discount codes: create, activate/deactivate, usage stats (#45)
        reviews/page.tsx    # review moderation: approve, hide, answer (#47)
        settings/page.tsx   # shop settings editor: VAT rate, shipping + payment methods (#64)
        catalog-types/page.tsx, catalog-types/[key]/page.tsx  # catalog type editor:
                            # label, position, dimensions, brands, flags (#64, writes
                            # through saveCatalogTypeCore)
        translations/page.tsx          # translation table: search + area filter, per-language
                            # columns with a visible "fehlt" fallback marker (#58)
        translations/[key]/page.tsx    # one text: German base + every language column (#58)
        translations/languages/page.tsx # language rows editor — a new language is a form,
                            # deactivate instead of delete (#58)
      labels/[orderId]/route.ts    # GET label PDF (session-guarded, §4)
      invoices/[orderId]/route.ts  # GET invoice PDF (session-guarded, §4, #40)
    api/
      search/route.ts       # GET instant search JSON
      products/route.ts     # GET faceted listing JSON (documented JSON API, §4)
      recently-viewed/route.ts  # GET products behind remembered slugs, newest first (#46)
      shop-settings/route.ts    # GET the public commerce configuration for the storefront
                            # client components (cacheable 60 s, #64)
      health/route.ts       # GET { ok } — also warms DB connection
  components/
    not-found-content.tsx   # German 404 content shared by the per-root not-found pages (#58)
    password-rules-checklist.tsx  # live, aria-announced password rule checklist shared
                            # by every form that sets a password (#60)
    shop-settings-provider.tsx    # client context: loads /api/shop-settings once per page
                            # so cart/checkout compute totals from the configuration (#64)
    ui/                     # vendored shadcn components (kept canonical, knip-ignored, §13)
    storefront/             # named "storefront" (not "shop") — recorded deviation, DECISIONS
      header.tsx, mega-menu.tsx, search-instant.tsx, theme-toggle.tsx, footer.tsx,
      language-switcher.tsx  # one link per active language row to the same page in that
                            # language, aria-current + query preserved (#58)
      cart-drawer.tsx, cart-button.tsx, cart-provider.tsx, cart-page-view.tsx, product-card.tsx
      listing-shell.tsx, filter-sidebar.tsx, sort-select.tsx, pagination.tsx, skeletons.tsx,
      empty-state.tsx, free-shipping-progress.tsx
      gallery.tsx, product-detail.tsx   # variant picker inlined in product-detail
      stock-indicator.tsx, related-products.tsx, checkout-form.tsx,
      product-image.tsx            # photo vs neutral placeholder (§11)
      vat-label.tsx                # configured VAT wording in a dynamic hole (#64)
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
       command-palette.tsx, # ⌘K/Ctrl+K palette + "?" shortcut overlay on the picker (#49)
      po-status-actions.tsx, po-status-badge.tsx, supplier-form.tsx,
       revenue-sparkline.tsx, pack-list.tsx, label-actions.tsx,
       invoice-actions.tsx,         # payment / reminder / credit-limit forms (#40)
        customer-actions.tsx,        # block / notes / password-reset forms (#43)
         pickup-actions.tsx,          # mark-ready + handover (code, cash/card) forms (#41)
         discount-forms.tsx,          # create + activate/deactivate codes (#45)
         review-actions.tsx,         # approve / hide / answer a review (#47)
         shop-settings-form.tsx,     # VAT + shipping + payment method editor (#64)
         catalog-type-editor.tsx     # catalog type form: label, dimensions, brands (#64)
         translation-editor.tsx      # one text: key, area, German base, language columns (#58)
         languages-editor.tsx        # language rows: code, label, intlLocale, position, active (#58)
  models/                   # mongoose schemas (pure shapes re-exported from src/lib, §2 purity)
    product.ts order.ts checkout-claim.ts user.ts supplier.ts purchase-order.ts counter.ts
    product-type-config.ts  # product types, variant dimensions, facets as data (#61, §3)
    shop-settings.ts        # the one shop_settings document: VAT, shipping, payment (#64, §3)
    discount-code.ts        # marketing codes: percent/fixed, window, limits (#45)
    discount-usage.ts       # (code, customer) redemptions — unique _id enforces once-each (#45)
    password-reset.ts       # hashed one-hour reset tokens (TTL index, #39)
    mail-message.ts         # dev outbox messages (#39/#44)
    restock-alert.ts        # (sku, e-mail) back-in-stock subscriptions, notify-once (#46)
    review.ts               # verified-buyer reviews: pending/approved/hidden (#47)
    stock-unit.ts           # unit ledger of serial-tracked types: serial unique per SKU (#62)
    language.ts             # languages as rows: code, label, intlLocale, position, active (#58)
    translation.ts          # the one translation table: key, area, de base, texts map (#58)
  lib/                    # PURE domain logic — no I/O, no mongoose, no fs, no fetch
                          # (guard test: tests/lib-purity.test.ts)
    product-types.ts        # ProductType = string — types are data now (#61), the alias only names it
    catalog-types.ts        # CatalogTypeConfig/CatalogDimensionConfig shapes + DEFAULT_CATALOG_TYPES
                            # (seed content only) + pure dimension/facet helpers (#61)
    shop-settings.ts        # ShopSettings shape (VAT, shipping + payment methods) +
                            # DEFAULT_SHOP_SETTINGS (seed content only) + VAT copy helpers (#64)
    i18n.ts                 # languages + translation entries as data, resolveLanguage precedence
                            # (prefix > cookie > browser > default), German fallback + missing
                            # report, DEFAULT_LANGUAGES/DEFAULT_TRANSLATIONS seed content (#58)
    dto.ts                  # ProductDto/VariantDto types (server/search re-exports + maps)
    format.ts               # createFormatters(intlLocale): CHF, dates, weights (#58);
                            # base-locale exports for the German-based admin/mails/invoices
    dates.ts                # Swiss calendar days (Europe/Zurich): day keys, DST-safe bounds
    numbers.ts              # formatOrderNumber/formatPoNumber/formatPaymentReference
    password-rules.ts       # password rules per scope (customer/admin) — single source
                            # for server validation and the live checklist (#60)
    pricing.ts              # totals, VAT rounding + copy, buyable price — every rate/price
                            # comes from the shop settings, no constants (§8 note, #64)
    stock.ts                # pure stock rules: isLowStock, stockLevel, stockLabel
    stock-units.ts          # unit state machine (in_stock → reserved → packed → shipped →
                            # sold, cancel releases), order-status→unit-move map, serial
                            # input rule — all pure (#62)
    purchasing/incoming.ts  # expected arrival from lead time, open quantity per SKU,
                            # German "N Stk. bestellt, Ankunft ca. …" copy — pure (#62)
    facets.ts               # deriveFilter(variants, dimensions) + ProductFilter keyed by dimension
                            # key — generic over the configured dimensions (#61, §3/§4)
    facet-order.ts          # natural facet value ordering per a dimension's order rule
    regex.ts                # escapeRegex (shared by search + SKU search)
    menu.ts                 # menuCategories(types) — mega-menu from the type configs (#31 → #61)
    collections.ts          # Neuheiten | Bestseller | Sale (seed, listing, home, menu)
    product-selection.ts    # variant dimensions/selection + color→photo-slot rule (#18/#19)
    site.ts                 # SITE_URL + absoluteUrl (metadata, JSON-LD)
    locale-path.ts          # splitLanguagePrefix/localizedPath — the language prefix as
                            # pure path arithmetic, codes passed in as data (#58)
    images.ts               # isPhotoSrc — photo vs placeholder rule (§11)
    orders/state-machine.ts # statuses, transitions + validation + logging (pure)
    orders/labels.ts        # German order status labels (UI copy only)
    purchasing/labels.ts    # PurchaseOrderStatus + German PO labels (#35)
    shipping/types.ts       # ShippingProvider interface, label result types
    shipping/weight.ts      # parcel weight = Σ qty×weight + PACKAGING_GRAMS (150 g constant)
    order-visibility.ts     # who may see full order PII (cookie/admin/owning account, #39)
    payments.ts             # counter handover payment types (cash/card) (#41) — the payment
                            # methods themselves are shop settings now (#64)
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
    catalog-types.ts        # getCatalogTypes/getCatalogType/saveCatalogTypeCore — the type-config
                            # source read by all generic catalog code (#61)
    shop-settings.ts        # getShopSettings/saveShopSettingsCore — the commerce configuration
                            # read by pricing, checkout, state machine context and admin (#64)
    i18n.ts                 # getLanguages/getTranslations/getTranslator + save cores — the one
                            # access point to the language and translation tables, process-cached
                            # and invalidated on every write (next request, no deploy) (#58)
    env.ts                  # zod-validated env access (MONGODB_URI, UPS_*, SMTP_*, SESSION_SECRET,
                            # CUSTOMER_REGISTER_LIMIT_PER_HOUR,
                            # CUSTOMER_RESET_LIMIT_PER_HOUR,
                            # CHECKOUT_LIMIT_PER_10_MIN optional)
    numbers.ts              # mintNumber(counterId, format) — shared order/PO number minting
    session-token.ts        # pure HMAC cookie sign/verify (scope: admin | customer, #39)
    session.ts              # admin + customer login/session (scrypt, throttle, scoped cookies)
    customers.ts            # register (rate limit = CUSTOMER_REGISTER_LIMIT_PER_HOUR,
                            # default 5/h), password reset (CUSTOMER_RESET_LIMIT_PER_HOUR,
                            # default 3/h), address book, claim order (#39)
    customers-admin.ts      # customer list/detail, block, notes, admin password reset (#43)
    command-palette.ts      # ⌘K palette search: orders/products/customers/suppliers (#49)
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
    purchasing.ts           # supplier + PO cores (create/markOrdered (atomic draft guard,
                            # #62)/receive — partial + serial registration, transaction),
                            # expected arrival (editable),
                            # getIncomingBySkuCore (open PO lines → per-SKU incoming),
                            # picker searches: variants by sku/name/brand + suppliers (#42, #62)
    stock-units.ts          # unit-ledger data access for serial-tracked types: goods-receipt
                            # registration (duplicate serials refused, history note names the
                            # PO), reservation inside the checkout txn, advance/release with
                            # the order, ledger search with PO numbers (#62)
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
      checkout.ts           # thin action wrapper → createOrderCore (transaction, + userId #39,
                            # rate limit = CHECKOUT_LIMIT_PER_10_MIN, default 10/10 min #8/#58)
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
      admin/settings.ts     # saveShopSettings → saveShopSettingsCore (#64)
      admin/catalog-types.ts # saveCatalogType → saveCatalogTypeCore (#64)
      admin/translations.ts # saveTranslation → saveTranslationCore, saveLanguage →
                            # saveLanguageCore (#58)
      admin/command-palette.ts # commandSearch action for the ⌘K palette (#49)
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
(`priceCents` etc.), gross (configured VAT rate included, §3/#64). Weights in **grams**. All field names English.

### Product (`products`)
```ts
{
  slug: string            // unique
  name: string
  description: string
  type: string            // key into product_type_configs (#61) — validated in the cores
  brand: string
  priceCents: number      // base gross price
  images: [{ src: string, alt: string }]        // 1–5 slots, /products/<slug>-<n>.webp
  featured: boolean
  collection?: string     // e.g. "Neuheiten", "Bestseller"
  filter: Record<string, string[]>
                          // denormalized facet source keyed by dimension key ("color", "size",
                          // "storage", …) — derived from variants, see rule below (#61)
  variants: [{
    sku: string                     // unique across all products
    label: string                   // e.g. "42 / schwarz", "256 GB / titan"
    priceDeltaCents: number
    stock: number
    restockThreshold: number        // low-stock alert level
    weightGrams: number
    attributes: Record<string, string | number>   // keys are the type's configured dimensions
  }]                                              // (#61) — validated against the config in cores
  createdAt, updatedAt
}
```
**`filter` maintenance rule:** `filter` is recomputed with the pure
`deriveFilter(variants, dimensions)` (`src/lib/facets.ts`, values ordered per each
dimension's configured `order` rule) and written **inside every operation that creates or
touches variants** (seed, `updateVariant`, `updateProduct`). Document middleware is never
relied on — Mongoose hooks do not run on `findOneAndUpdate`/`updateOne`, which is exactly
how the block would go stale. Unit-tested; an integration test asserts "edit a variant's
colour → listing facet reflects it".

**Agnostic write path (#61):** `attributes` and `filter` are Mixed in the schema (any
dimension key a type config may define); validation happens in the cores — variant
attributes are validated against the type's configured dimensions in `updateVariantCore`
(`updateProductCore` does not change `type`; there is no admin path that sets it).
A re-seed repairs documents still holding the pre-#61
`filter.colors/sizes/…` shape to the new dimension-keyed shape.

Indexes:
- `{ slug: 1 }` unique
- `{ 'variants.sku': 1 }` unique
- `{ type: 1, brand: 1 }`, `{ type: 1, 'filter.size': 1 }`, `{ type: 1, 'filter.storage': 1 }`,
  `{ type: 1, 'filter.color': 1 }`, `{ type: 1, 'filter.material': 1 }` — faceted filters
  (one index per seed dimension key; dimensions added at runtime query unindexed, fine at
  catalog size and recorded in DECISIONS)
- `{ type: 1, priceCents: 1 }`, `{ type: 1, createdAt: -1 }` — sorting
- `{ featured: 1, type: 1 }` — home page
- No text index: search is a regex-escaped literal prefix on `name`/`brand` (§4) — enough at
  200 docs, so the write-time cost of a text index is not paid (recorded in DECISIONS)
- Listing queries hit compound filters + sort with `{ type: 1, ...facet..., <sort>: 1 }` shapes;
  **every sort appends `_id: 1` as tiebreaker** (stable pagination) and `page` is clamped to
  `[1, ceil(total/pageSize)]`. The aggregate for facets uses `$facet` over the type-filtered set.

### ProductTypeConfig (`product_type_configs`, #61)
```ts
{
  key: string             // unique — the Product.type value ("smartphone", …)
  label: string           // German UI label ("Smartphones")
  position: number        // order in menus/tabs
  stockTracking: 'quantity' | 'serial'   // stock model hook for #62
  comparable: boolean     // may enter the side-by-side comparison (replaces type checks)
  photoNoun: string       // English subject for the image-prompt generator (#61 review)
  brands: string[]        // demo brands (seed + mega-menu columns)
  dimensions: [{
    key: string           // variant attribute key ("color", "storage", …)
    label: string         // "Farbe", "Speicher", …
    facet: boolean        // offered in the listing facet column
    order: 'alpha' | 'numeric' | 'clothing-size'
    unit?: string         // display suffix ("GB")
  }]
}
```
The single source for every catalog question; `DEFAULT_CATALOG_TYPES`
(`src/lib/catalog-types.ts`) is only its seed content. Read through
`getCatalogTypes()`/`getCatalogType()`, written through `saveCatalogTypeCore` (validated);
the seed inserts it **insert-only** (#14 rule — admin edits survive re-seeds). An empty
collection falls back to the seed content so a fresh build works before seeding.

### ShopSettings (`shop_settings`, #64)
```ts
{
  key: string             // unique — the single document is "shop"
  vatRatePercent: number  // gross prices include this rate (§8 rule)
  freeShippingFromCents: number
  shippingMethods: [{ key, label, priceCents, position, active, storePickup,
                      expressService, hint }]
  paymentMethods:  [{ key, label, position, active,
                      kind: 'immediate' | 'invoice' | 'on_pickup' }]
}
```
The single source for every commerce question (VAT rate, shipping prices, the payment
method set); `DEFAULT_SHOP_SETTINGS` (`src/lib/shop-settings.ts`) is only its seed
content. Read through `getShopSettings()` (empty collection → defaults), written through
`saveShopSettingsCore` (validated: key format/uniqueness, price bounds, and never the last
active shipping/payment method — the checkout can't be configured into a dead end); the
seed inserts it **insert-only** (#14 rule). Orders store the chosen `method` key plus the
flow data the workflow needs without the config (`shipping.storePickup`,
`shipping.expressService`, `payment.kind`); a retired method falls back to its stored key
in labels, and the label service level reads the stored `expressService` flag, never the
key (DECISIONS, #62 review). The storefront client components read the configuration
through `ShopSettingsProvider` via `GET /api/shop-settings` (dynamic route,
`public, max-age=60` — a tab can lag an admin edit by up to a minute, DECISIONS).

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
            totalCents, weightGrams, serials?: string[] }]  // serials: the exact units
                            // reserved for a serial-tracked line (#62); admin-only, like
                            // the ledger — serials tie a device to a customer
  totals: { subtotalCents, shippingCents, totalCents, vatCents }
  shipping: { method: string,        // shipping-method key from the shop settings (#64)
              storePickup?: boolean, // flow flag stored at checkout (§5, #64)
              expressService?: boolean, // flow flag stored at checkout; the label
                             // service level reads it, never the method key (#62 review)
              carrier?: 'ups',
              trackingNumber?, labelPath?, parcelWeightGrams?,
              pickup?: { code, readyAt?, pickedUpAt?, paymentType?: 'cash'|'card' } }
  payment: { method: string,         // payment-method key from the shop settings (#64)
             kind: 'immediate' | 'invoice' | 'on_pickup',  // money flow, stored at checkout
             reference: string, paidAt?: Date,
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
  orderedAt?, expectedArrivalAt?, receivedAt?: Date
}
```
Indexes: `{ poNumber: 1 }` unique, `{ status: 1, createdAt: -1 }`.
`expectedArrivalAt` (#62) is set from the supplier's `leadTimeDays` when the PO goes
`ordered` and stays editable per PO; a partial receipt (`lines[].received < qty`)
keeps the PO `ordered` — the remainder is the incoming stock (§4).

### StockUnit (`stock_units`, #62)
The unit ledger of **serial-tracked types** (type config `stockTracking: "serial"`);
quantity types never get documents here.
```ts
{
  sku: string             // the variant this piece belongs to
  serial: string          // IMEI / serial — unique per SKU
  status: 'in_stock' | 'reserved' | 'packed' | 'shipped' | 'sold'
  orderNumber?: string    // the customer order the unit is bound to
  purchaseOrderId?: ObjectId  // the PO whose goods receipt registered it
  history: [{ status, at, note? }]  // every move, logged
}
```
Indexes: `{ sku: 1, serial: 1 }` unique (duplicate serials refused by the index),
`{ sku: 1, status: 1 }`, `{ orderNumber: 1 }`, `{ status: 1, updatedAt: -1 }`.
The variant's `stock` of a serial-tracked variant **is the count of its `in_stock`
units** — goods receipt and orders are the only writers; `updateVariantCore` refuses
direct stock edits for serial types (DECISIONS).

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

### Language (`languages`, #58)
`{ code (unique, 2–3 letters), label, intlLocale, position, active }` — the shop's
languages are rows (seed: de, fr, it, rm, es with `de-CH|fr-CH|it-CH|rm-CH|es`); the
switcher, the resolver and the editor iterate this collection, so a new language is one
row. `activeLanguages` (position order) is what every reader sees.

### Translation (`translations`, #58)
The **single translation table**: `{ key (unique), area: 'shop'|'admin'|'mail'|'invoice'|
'catalog', de (required base text), texts: Mixed map keyed by language code }`. The map —
not fixed fields — is what makes a new language a data change. Missing or blank texts fall
back to `de` and are reported by the translator (`missingKeys()`). `src/server/i18n.ts` is
the only access: rows are process-cached and every write (`saveTranslationCore`,
`saveLanguageCore`) invalidates the cache, so edits take effect on the next request
without a deploy. Step 1 of #58; extracting the remaining UI texts into rows is step 2.
Customer-visible order status names are rows too (`shop.status.<status>`, keys derived
from the state-machine statuses); `STATUS_LABELS` and `PICKUP_PAYMENT_TYPE_LABELS`
remain the German base for the admin until its own slice — storefront components take
an optional label map and read the table when one is passed (#58 step 3).

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
  here. For types whose config says `stockTracking: "serial"` (#62) the same transaction
  additionally reserves **specific units** (`reserveUnitsForOrder`: one conditional
  `findOneAndUpdate` per piece, `in_stock → reserved` bound to the order number; too few
  free units aborts everything like `InsufficientStockError`) and records the serials on
  the order line — unit ledger and stock count can never disagree.
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
  Serial units travel with the order (#62, `src/lib/stock-units.ts` maps order status →
  unit move): `packed`/`shipped` advance them (the label route moves `shipped`),
  `delivered`/`picked_up` sell them, a restocking cancel releases them back to
  `in_stock` — always in the same transaction as the order move. Serials print on the
  packing slip, the label data (`LabelRequest.serials`, rendered by the mock label and
  sent to UPS as `Shipment.ShipperReferences`) and the invoice PDF; they are admin-only
  (customer-linked, like the ledger).
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
- `receivePurchaseOrderCore(poId, quantities?, serials?)` — increments `variant.stock` per
  line and sets `received` in one transaction. Partial receipts (#62): `quantities` per SKU
  defaults to everything still open; a line below its open quantity keeps the PO `ordered`
  — the remainder stays visible as incoming stock. For serial-tracked lines each received
  piece must carry a serial (`serials` per SKU, duplicates refused by the unique index and
  within the batch); each becomes an `in_stock` unit bound to the PO.
- Incoming stock (#62, `getIncomingBySkuCore` + `src/lib/purchasing/incoming.ts`): what is
  on order is **derived** from the open lines of `ordered` POs (`Σ qty − received`, earliest
  `expectedArrivalAt`), never stored on the product. The product page and variant picker
  show „N Stk. bestellt, Ankunft ca. in 3 Tagen" on low/zero-stock variants, the admin
  variant editor shows the open quantity; the PO detail shows and edits the expected
  arrival (set from the supplier lead time when ordering).
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
  tracking, transitions to `shipped`. The `LabelRequest` carries the order's serial numbers
  (`serials`, from the order lines) so the label data names the exact devices (#62 review);
  quantity orders send none.

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
- `GET /orders/[number]/invoice` → the same invoice PDF behind the **order visibility
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
`ready`/`picked_up` — the flow flags in the transition context separate the chains.
- `canTransition(from, to, ctx)` from an explicit adjacency map; the context carries
  `viaLabel`, `viaInvoicePayment`, `viaPickupHandover` and the **behavior flags** derived
  from the order's stored flow data (`storePickup`, `processBeforePayment`,
  `payAtHandover` — `flowFlagsFor`, #64: the graph never names a method key). `new →
  picking` is legal **only for pay-later orders**; `new → paid` of such an order is legal
  **only** via `viaInvoicePayment` (the money is recorded on the invoice, not by the status
  buttons). `allowedTransitions(from, flags)` hides exactly those from the admin buttons.
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

- **Routes and public URLs are English (#63), prefixed by the language (#58):** the app routes
  themselves are `/[lang]/products`, `/[lang]/products/:slug`, `/[lang]/cart`… — no rewrite
  indirection. The proxy resolves the language for every prefix-free storefront request
  (URL prefix > remembered `lang` cookie > `Accept-Language` > first active language row),
  redirects to `/{lang}{path}` with the query preserved, and refreshes the cookie on prefixed
  requests; its gates (admin, account, product-slug 404) run on the stripped path. The admin
  stays prefix-free. `next.config.ts` `redirects()` answers every former German URL
  (`/produkte`, `/produkt/:slug`, `/warenkorb`, `/kasse`, `/bestellung/:number`, `/konto/…`)
  with a permanent 308 to its English counterpart (redirects run before the proxy); the
  mapping is configuration, not code. Query params are English
  (`type, brand, size, color, storage, material, sort, page`) because they are code-facing.
- **Server Components** own data fetching: home, listing first paint, product page, all admin
  pages render from Mongoose directly (no client fetch waterfall, no API keys in bundle).
- **Client islands**: header + mega-menu + instant search, cart drawer/button, theme toggle,
  gallery, variant picker, filter sidebar/sort/pagination, route transition wrapper, admin
  editors.
- **Listing SPA pattern**: `/products` server-renders page 1 and hydrates a `ListingShell`
  (client) that owns subsequent updates: facet clicks call `router.replace(url, { scroll:
  false })` and fetch `/api/products` in parallel; results cross-fade with motion; skeletons
  while pending; `history` back/forward works because URL is the single source of truth.
- **Cart**: `src/stores/cart.ts` — tiny external store (`useSyncExternalStore`), persisted to
  `localStorage` (`cart:v1`), hydrated after mount (no SSR mismatch), badge + drawer update
  optimistically from any page; quantity changes animate.
- **Navigation**: `next/link` prefetch on viewport entry; `<RouteTransition>` keys on
  `usePathname()` with a motion **opacity-only** fade **enter-only** (150 ms — issue #59:
  the old `y` slide visibly shifted the whole page on every click; `html` also reserves
  the scrollbar via `scrollbar-gutter: stable` so pages of different heights cannot
  shift content horizontally; toasts sit `bottom-center` so they never cover the cart
  drawer's or the cart summary's „Zur Kasse“, and adding to the cart gives feedback by
  opening the drawer instead of a toast; respects `prefers-reduced-motion`
  ) — App Router unmounts the old tree immediately, so exit animations
  are explicitly not attempted; mega-menu opens on hover (desktop) / tap (mobile).
- **Mutation UX**: checkout and admin actions use `useActionState`/`useFormStatus` with
  optimistic UI where safe (cart, wishlist-free), toasts for feedback.

## 8. UX concept per page

Global: mobile-first, dark mode via the `next-themes` package (class strategy,
`prefers-color-scheme` default, toggle in header), visible focus rings, semantic landmarks,
German copy, CHF/dates/weights formatted with the `Intl` locale of the request's language
row (`createFormatters(intlLocale)` in `src/lib/format.ts`, #58 step 2b) — the storefront
reads it from the `LocaleFormatters` context (client) or `getIntlLocale(lang)` (server);
the German-based admin, mails and invoices use the base-locale exports.

**VAT rounding rule (unit-tested):** `vatCents = grossCents − round(grossCents × 100 /
(100 + vatRatePercent))` where `grossCents` is the VAT-inclusive total and `vatRatePercent`
comes from the shop settings (#64); pricing tests and the confirmation page must agree by
construction. **Packaging constant:** `PACKAGING_GRAMS = 150` in
`src/lib/shipping/weight.ts`, unit-tested; parcel weight = Σ qty×weightGrams + 150.
**Commerce rules are configuration (#64):** VAT rate, shipping prices and the free-shipping
threshold live in the `shop_settings` document (§3), not in code — the seed content starts
at standard CHF 4.90, express CHF 12.90, free from CHF 100 (docs/DECISIONS.md).

- **Home** — full-bleed hero (headline, CTA, featured product collage with parallax float),
  category tiles (smartphones/schuhe/kleidung) with hover zoom, "Beliebte Produkte" rail
  (horizontal scroll-snap), featured collection band. Motion: staggered fade-up on load.
- **Header** — sticky, blur backdrop; logo, mega-menu (type → brand/attribute columns + promo
  tile), instant search (debounce 200 ms, `⌘K`/`/` focus, arrow-key + Enter navigation,
  `role="combobox"`/`aria-expanded`), theme toggle, cart button with animated count badge.
- **Listing /products** — left facet sidebar (checkbox groups per type: brand, size, color,
  storage, material; counts per facet), top bar (result count, sort select, mobile filter
  sheet), responsive product grid (2/3/4 cols), skeleton cards, empty state with reset action,
  numbered pagination + "Zeige 1–24 von 70". URL params: `type, brand, size, color, storage,
  material, sort, page`.
- **Product page /products/[slug]** — breadcrumbs; gallery (main image + thumbnails, swipe via
  drag, click-to-zoom dialog, crossfade on variant color change); title, price (animated on
  variant change), variant pickers (color/size/storage chips, disabled when out of stock),
  stock indicator (grün/gelb/rot text + dot), qty stepper, "In den Warenkorb" (opens drawer),
  weight/description accordion, related products (same type+brand first), JSON-LD `Product`
  with offers per variant.
- **Cart drawer / /cart** — drawer from right (sheet), line items with variant label, qty
  steppers (optimistic), subtotal, free-shipping progress bar, "Zur Kasse"; full page mirrors
  drawer for deep links.
- **Checkout /checkout** — single column, 3 anchored steps (Adresse → Versand → Zahlung),
  zod-validated client + server, mock payment (card form stub), summary sidebar sticky;
  success → confetti-light motion → redirect confirmation. Issue #39: logged-in customers
  start prefilled from profile + default shipping address and their orders carry `userId`;
  guests see an "Anmelden / Konto erstellen / als Gast bestellen" banner.
- **Account /account (customer portal, #39)** — proxy-guarded (customer-scope cookie) with a
  login/register/forgot-password/reset area under `/account/(auth)`. Portal: overview,
  Bestellungen (newest first, search by number/article, guest-order claim by e-mail,
  „Erneut bestellen" with today's prices/stock), Adressen (address book, one default per
  kind), Profil (data, password change, logout). E-mail + password are the identity; the
  order confirmation page shows full PII to the owning account too (`order-visibility.ts`).
- **Order confirmation /orders/[number]** — big confirmation, status timeline (state machine steps), items,
  totals incl. VAT note from the shop settings ("8,1 % MwSt. inbegriffen" with the seed rate), tracking number once shipped. **Buyer-only
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
- **Admin Purchasing** — suppliers CRUD-lite, PO list with status chips + expected arrival
  column (#62); PO editor (add lines by SKU search, qty, cost); "Bestellen" (draft→ordered,
  stamps `expectedArrivalAt` from the supplier lead time) and the receipt form (#62):
  per-line received quantity (partial keeps the rest on order) plus one serial per piece
  for serial-tracked lines; full receipt → `received`, toast with delta summary; the
  expected arrival stays editable per PO.
- **Admin Serienlager (#62)** — the unit ledger: search by serial or SKU, one card per unit
  with serial, status chip, bound order/PO and the full per-unit history; linked from the
  variant editor of serial-tracked products ("Serien ansehen"). Serials are admin-only.
- **Admin Mails (#39/#44)** — the dev outbox: every mail the shop would have sent
  (registration, password reset, …) listed newest first with the plain-text body.
- **Admin Einstellungen (#64)** — the shop settings editor: VAT rate, free-shipping
  threshold, shipping methods (label, price, pickup flag, hint) and payment methods
  (label, kind, active) as rows; save → `saveShopSettingsCore`, storefront follows.
- **Admin Katalogtypen (#64)** — the `product_type_configs` editor: list by position,
  edit page per type (label, position, photoNoun, stockTracking, comparable, brands,
  dimensions with key/label/facet/order/unit) through `saveCatalogTypeCore`.

## 9. Seed data (deterministic, idempotent, clock-relative)

`scripts/seed/catalog.ts` uses a seeded PRNG (mulberry32, fixed seed) — same 200 products every
run: 70 smartphones (brands Apple/Samsung/Xiaomi/Google/OnePlus; storage 64–512 GB; colors),
70 shoes (Nike/Adidas/Puma/On/Running…; EU 36–47; colors), 60 clothing (Northface…; XS–XXL;
materials) — the types, their brands and variant dimensions come from the type configs
(`DEFAULT_CATALOG_TYPES` upserted into `product_type_configs`, insert-only, #61).
Realistic German descriptions from template pools, CHF price ranges per type,
variant stock 0–80 (a few at 0 and a few below threshold for alerts), weights per type range.
Serial-tracked types (#62) stock like a real phone shelf — 0–8 pieces per variant — and
`seedStockUnits` gives every in-stock piece its own `in_stock` unit document with a
deterministic IMEI-shaped serial (skipped while `stock_units` is not empty, idempotent).
The seed records 1–5 image slots per product with their final photo paths
(`/products/<slug>-<n>.webp`) but writes no image files itself — the photo pipeline (§11)
owns `public/products/` (issue #29). Also seeds admin user, 3 suppliers, sample POs and ~15
orders across all statuses so admin screens are alive. The `ordered` sample PO carries one
serial-tracked line (chosen by the type configs' `stockTracking`, not a hard-coded type) so
goods-receipt-by-serial and the serial → PO ledger trace are demonstrable end to end (#62).

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
prices (4.90/12.90, free ≥ 100 — seed content of the shop settings since #64) and VAT
rounding rule, MMS binary pinning + download cache +
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
- `purchasing.spec.ts` — open the seeded `ordered` PO → read its lines → type one serial
  per received piece on serial-tracked lines (#62) → "Wareneingang" → every line's variant
  stock increased by exactly the ordered quantity (stock read through the admin product
  search page) → the serial ledger (`/admin/stock-units?q=<serial>`) shows the received unit
  with its PO number linking to the purchase-order detail and the receipt history note
  naming that PO (#62 review: the serial → PO trace is proven in the admin UI).
- `incoming-stock.spec.ts` (#62) — create + order a PO for a quantity-tracked variant →
  expected arrival visible → admin variant and shop product page show „N Stk. bestellt,
  Ankunft ca. …" on the sold-out variant → goods receipt grows stock and shrinks the note.
- `serial-stock.spec.ts` (#62) — buy one smartphone in the storefront → the ledger shows the
  reserved unit with its serial bound to the order → picking/packed (serial on the packing
  slip) → label → shipped → delivered → the same serial reads „Verkauft" with the full
  history.
- `translations.spec.ts` (#58) — admin edits a seeded text's French column and sees it on
  reload → creates a new key (German base + one language, untranslated columns show the
  visible „fehlt" marker) → adds a language row (Portuguese) through the languages editor.
- `language-routing.spec.ts` (#58) — browser language picks the prefix and `<html lang>` →
  hreflang lists every active language + x-default for the same path → switcher keeps page,
  query and the remembered choice → every language serves the listing → unknown product
  answers a real 404 behind the prefix.
- `confirmation-translations.spec.ts` (#58 step 3) — a completed French checkout shows the
  French confirmation (thanks, heading, status chain/badge, totals, addresses) → a stranger
  opening the same URL sees the French access form, never the German one. Together with
  `storefront.spec` this is step 5's two-language completed checkout.

Run order for the full gate: `npm run build && npm run test:e2e` (the build is a hard
prerequisite; `npm test` and `npm run lint` are independent).

## 13. Code quality (knip)

`knip` (exact-pinned devDependency, `knip.json`, `npm run knip`) enforces "no dead code":
nothing may be exported without a second-file consumer, no file may be unreachable, no
dependency unused. Exceptions: `src/components/ui/**` is vendored shadcn code kept in
canonical upstream shape on purpose (DECISIONS #34). CI-equivalent local checks:
`npm run knip && npm run lint && npm test && npm run test:e2e`.
