# coder-shop — Decisions

Recorded per REQUIREMENTS ("choose the professional default and record the decision").

## Toolchain (M1)

- **TypeScript 6.0.3 instead of the 7.0.2 pin** (toolchain gate, ARCHITECTURE §1): the
  scaffold builds and lints green with `typescript@^6.0.3` + Next 16.4.2; 7.0.2 is not
  resolvable as a stable release here. All other pins are exactly as specified.
- **Vitest 5 pool config:** `test.poolOptions` was removed in Vitest 4/5. The single-worker
  requirement (shared throw-away replica set must never be wiped while another file reads)
  is expressed as top-level `maxWorkers: 1` + `fileParallelism: false` in `vitest.config.ts`.
- **mongodb-memory-server binary:** pinned to mongod `8.2.6` (verified working against the
  MMS 11 support matrix on this machine) with `downloadDir: ".cache/mongod"` in
  `package.json`; downloaded once during M1, later runs are offline. Distro check:
  Ubuntu 26.04 — auto-detection works; `MONGOMS_SYSTEM_BINARY` documented in the README as
  the fallback for distros where it fails.
- **shadcn `cn` helper:** components import `cn` from `@/lib/utils` (clsx + tailwind-merge),
  the canonical shadcn layout.

## Domain (carried from the review, ARCHITECTURE §10)

- Money as integer cents, gross prices (VAT 8.1 % included); VAT rule
  `vatCents = grossCents − round(grossCents × 100 / 108.1)`.
- Denormalized `filter` block recomputed via pure `deriveFilter` in every operation that
  touches variants (never via document middleware).
- Custom cart store (`useSyncExternalStore`, `localStorage` `cart:v1`) — no zustand.
- Own session/crypto (scrypt N=2^15/r=8/p=1, 12 h HMAC cookie, Origin checks, login
  throttle) instead of next-auth.
- Listing JSON API + URL-as-state; mock payment auto-pays.
- Stock model: decrement at `createOrder`, restock on cancel from `new`/`paid`/`picking`,
  no reservations — real transactions on a single-node replica set.
- Shipping: standard CHF 4.90, express CHF 12.90, free from CHF 100;
  `PACKAGING_GRAMS = 150`.
- Labels under `data/labels/` (outside the web root — PII).
- Deployment target: long-running Node server, all routes `runtime = 'nodejs'`, production
  requires `MONGODB_URI`.
- English code **and English public URLs** (superseded by #63 — see the #63 entry; the
  German-URL rewrites are gone); **no text index** — search
  is a regex-escaped literal prefix on `name`/`brand` (enough at 200 docs; a text index would
  be pure write-time cost and German stemming was never wanted).

## Storefront (M2)

- Seed smartphone brand list is weighted toward Apple (4/10 picks) so `brand=Apple`
  yields > 24 products and the M2 pagination acceptance check (`page=2` returns the next
  page) is exercisable; the 70/70/60 type split, determinism and idempotency are unchanged.
- Instant search matches the regex-escaped literal query at any **word boundary**
  (`(?:^|\b)query`), not only at string start — "iphone" must find "Apple iPhone 16".
- Product images are generated photos under `/products/*.webp`: rendered with `<img>`
  (the Next image optimizer via `srcSet`, §11); `@next/next/no-img-element` is disabled
  for `src/components/storefront/**` only. (Was "local SVGs" until the photo pipeline —
  the rule and its scope are unchanged, only the reason.)
- **`src/components/storefront/` instead of the planned `shop/`** (REQUIREMENTS named
  `shop/`): the directory arrived with M2 before the deviation was recorded; "storefront"
  is the clearer domain word next to `admin/` and renaming ~30 files plus every import
  for cosmetics is not worth it. Recorded here as the deliberate deviation.
- **`src/lib` purity is enforced by a test** (`tests/lib-purity.test.ts`, issue #35):
  no lib file may import `@/models`, `@/server`, `mongoose` or `node:*`. Pure shapes
  that models and DTOs share (`ProductType`, `ProductFilter`, `PurchaseOrderStatus`,
  the product DTO) live in the lib and are re-exported by the model/search modules
  their consumers already import from.
- `<RouteTransition>` animates via `useAnimationControls` on pathname change instead of
  `key={pathname}`: re-keying the wrapper that contains the PPR suspense holes breaks
  React's resume ("Couldn't find all resumable slots … during replaying") and the dynamic
  content never reaches the HTML.

## Admin auth & shipping (M4)

- **UPS API endpoints (pinned, looked up — never guessed):** OAuth token
  `POST https://www.ups.com/security/v1/oauth/token` (sandbox `https://wwwcie.ups.com`),
  `Authorization: Basic base64(clientId:clientSecret)`, form body `grant_type=client_credentials`,
  response `{ access_token, expires_in }`; Shipping API 2.0 ship resource
  `POST https://onlinetools.ups.com/api/shipments/v2409/ship` (sandbox host `wwwcie.ups.com`),
  `Authorization: Bearer <token>`, request root `ShipmentRequest`, label requested via
  `Shipment.LabelImageFormat.Code = "PDF"`, response
  `ShipmentResponse.ShipmentResults.PackageResults[].TrackingNumber` +
  `ShippingLabel.GraphicImage` (base64 PDF). `developer.ups.com` is not reachable from the build
  network (Akamai blocks it), so the endpoints and payload shapes were verified against the
  actively maintained Karrio UPS connector (`karrioapi/karrio` main branch,
  `modules/connectors/ups`) and public code matches for the token endpoint — not guessed.
  Service codes: standard → `11` (UPS Standard), express → `14`; weights in KGS.
- **Serial numbers ride the UPS payload as `Shipment.ShipperReferences` (#62 review):**
  `[{ Tag: "SERIAL", Value: <serials joined, ≤ 35 chars> }]` — the documented free
  reference slot of the same pinned v2409 ship resource; the mock label renders the same
  serial block from the pure `labelSerialLines` (`src/lib/shipping/label-content.ts`).
  Same caveat as the endpoints: exercised for real only once UPS credentials exist.
- **Admin guard lives in `src/proxy.ts` (Next 16 Proxy, Node.js runtime), not only in the
  layout:** with `cacheComponents` the route shell is prerendered, so a `redirect()` thrown
  while rendering the dynamic part streams a client-side `NEXT_REDIRECT` under HTTP 200 —
  `curl` never sees a redirect. The proxy runs before rendering and returns a real `307` to
  `/admin/login` for every `/admin/*` path except the login page; the layout's
  `requireAdminSession()` stays as defense in depth. Token verification is split into the pure
  `src/server/session-token.ts` so the proxy can verify the cookie without pulling in
  Mongoose/the DB layer.
- **Session cookie:** name `admin_session`, value `<base64url(payload)>.<base64url(hmac)>` with
  payload `{ userId, exp }` (12 h), HMAC-SHA256; signature verified with `crypto.timingSafeEqual`
  before `exp` is trusted. Secret: `SESSION_SECRET` env var — **required in production**
  (≥ 32 characters; a production start without it, or with a weak one, throws instead of
  falling back to anything in the source). Outside production a random per-process secret is
  generated (sessions end at restart, but tokens can never be forged from repository
  contents). A session only counts while the user still exists: `resolveSessionUserId`
  checks the DB after the signature check, so deleting an admin invalidates their cookies
  immediately (issue #2).
- **Login throttle:** in-memory Map keyed `ip|email`, 5 failures per 15 min window, then locked
  until the window ends (ARCHITECTURE §4.4 — acceptable for the single-process deployment).
- **`transitionOrderCore` throws `IllegalTransitionError`** for illegal edges (the state machine
  is the single source of truth; actions map it to a German error message) and restocks
  `new`/`paid`/`picking` cancels inside the same transaction.
- **`createLabelCore`** takes the provider as an optional parameter (defaults to the env-driven
  factory) so integration tests can inject mocks/failures without env juggling; the final
  `packed → shipped` move is a conditional `findOneAndUpdate` on `status: "packed"`, making
  double-clicks converge on the first label.

## Purchasing & dashboard (M5)

- **Suppliers are CRUD-lite without delete.** `saveSupplierAction` handles create and update
  in one action (presence of a hidden `supplierId` decides); deactivation is the model's
  `active` flag. Deleting suppliers would dangle `PurchaseOrder.supplierId` references, and
  the requirement says "suppliers, purchase orders" — not removal. Duplicate names are
  rejected via the unique index (error mapped to German).
- **PO workflow is enforced by conditional updates, not a state-machine class.**
  `draft → ordered → received` with `findOneAndUpdate({ status: "draft" })` for
  "Bestellen" and a transaction-guarded `status === "ordered"` check for goods receipt, so
  double-clicks and re-receipts fail cleanly instead of double-incrementing stock.
  `receivePurchaseOrderCore` increments each line's variant by `qty − received` (already
  received quantities are never counted twice) and sets `received = qty`, `status: received`,
  `receivedAt` in the same transaction; a missing product aborts the whole receipt.
- **PO numbers** `E-YYYY-######` come from the shared `Counter` document (`_id: "po"`)
  incremented inside the creation transaction — gap-free, same mechanism as order numbers.
- **PO editor default cost** is 60 % of the variant's sale price (mirrors the seed's PO
  prices), shown in an editable CHF field; the editor adds lines by case-insensitive SKU
  substring search (regex-escaped, ≤ 8 hits) through a server action — no extra API route.
- **Dashboard revenue** = `totals.totalCents` of orders with status
  `paid | picking | packed | shipped | delivered` created in the last 30 days, bucketed per
  UTC day (`$dateToString`) for the SVG sparkline (no chart library). "Offene Bestellungen"
  counts `new | paid | picking | packed`; "Lieferungen ausstehend" counts `packed` (label
  not yet created).
- **Low-stock list** reuses the pure `isLowStock(stock, restockThreshold)` predicate over
  all variants (sorted by stock ascending, capped at 25) — the acceptance test compares the
  table's data source against the expected set computed from the same predicate.
- **A11y verification** is an axe-core 4.14 scan of the rendered home/listing/product HTML
  (jsdom, one-off run — results in PROGRESS): 0 violations, 0 critical. `color-contrast`
  cannot execute in jsdom (no canvas); contrast is handled by the shadcn token palette.

## Product photos (M6)

- Generated photos are normalized to **WebP** via `sharp` (already present in
  `node_modules` as Next's optional image-optimizer dependency — now declared explicitly),
  whatever the API returns; requirements allow WebP/JPEG only, so the seed SVGs are never
  served as product imagery.
- One photo per view: image index n (1–5) maps to front/side/back/detail/lifestyle; the
  variant colour for image n is `variants[n % variants.length]`, mirroring the seed's SVG
  assignment. Prompts name only type/colour/material/view — never brands or trademarks.
- Per-image determinism via a 32-bit FNV-1a hash of `<slug>-<n>` as the API seed, so a
  restarted run reproduces the same image for a slot.
- Idempotency is file-based: an existing `<slug>-<n>.<webp|jpg|jpeg|png>` on disk means the
  slot is done (the document path is repaired if it drifted); `--limit` counts only actual
  generations. Exit code 0 iff no generation failed in this run.
- Storefront placeholder rule lives in one component (`product-image.tsx`): photo extensions
  render `<img>`, anything else (seed `.svg`) renders a neutral muted panel — no cartoon SVG
  is ever shown.

## QA (phase 6)

- **Session outlives the user:** `requireAdminSession` verifies the signed token only; a
  deleted admin keeps access until the cookie's 12 h `exp` passes. Deliberate for the
  single-admin demo (no user management exists); a real deployment would re-resolve the user
  per request or keep a revocation list.
- **List caps:** admin order and PO lists show the newest 200 entries (`ORDER_LIST_LIMIT` /
  `PO_LIST_LIMIT`) with a visible "neuesten 200" hint when the cap is hit — pagination is
  out of scope at demo scale but the truncation is no longer silent.
- **Dashboard revenue buckets by `createdAt`** (not `payment.paidAt`); the KPI card copy says
  "Umsatz der letzten 30 Tage (Status bezahlt bis zugestellt)" so the label matches the
  query.
- **E2E strategy:** Playwright (Chromium only) against a production build on its own port
  with a freshly seeded throw-away replica set (`tests/e2e/`, ARCHITECTURE §12) — the
  developer's `data/mongo` is never touched.

## BUG1 — admin session cookie over plain HTTP (issue #1)

- **Symptom:** production build on `http://<lan-ip>:4000` — login succeeds but every admin
  click redirects to `/admin/login`; on `http://localhost:4000` it works.
- **Root cause:** `setSessionCookie` set `Secure` whenever `NODE_ENV === "production"`.
  Browsers only store `Secure` cookies on trustworthy origins — https plus
  localhost/127.* — so on a LAN address over plain HTTP Chrome silently dropped the
  session cookie and the proxy redirected to the login on every request.
- **Decision:** the `Secure` flag is decided per login request
  (`resolveSessionCookieSecure` in `src/server/session.ts`): the explicit
  `SESSION_COOKIE_SECURE=true|false` env wins; otherwise the request's own protocol
  (`x-forwarded-proto` for TLS-terminating proxies, else the browser's `Origin`/`Referer`
  scheme); otherwise the old `NODE_ENV === "production"` default (non-request contexts).
  Served over https the cookie stays `Secure` exactly as before.
- **Trade-off (accepted):** on plain http no cookie flag can protect transport — a `Secure`
  cookie there is not "more secure", it is simply never stored, which broke the admin
  entirely. Sessions over an untrusted network must run behind TLS (or set
  `SESSION_COOKIE_SECURE=true` and serve https); on a trusted LAN the exposure is the same
  cleartext HTTP the login credentials themselves already have.
- **Regression test:** `tests/e2e/admin-session.spec.ts` — Playwright maps a non-localhost
  hostname to loopback (`--host-resolver-rules`) and drives login + three admin pages over
  plain HTTP; fails without the fix (cookie dropped, redirect to `/admin/login`).

## Issue queue (phase 7)

### #2 — session secret can no longer be forged from source
- Production refuses to serve sessions without `SESSION_SECRET` (missing or < 32 chars
  throws on first use); outside production the secret is random per process
  (globalThis-cached, so HMR/dev keeps sessions within one server run). The fixed
  `DEV_SESSION_SECRET` constant is gone — tokens can no longer be forged from repository
  contents.
- A valid signature alone is not a session: `resolveSessionUserId` additionally requires
  the user to exist, so deleting an admin invalidates their cookie immediately.

### #3 — order confirmation PII is buyer-only
- Order numbers are sequential, so `/bestellung/<number>` must not be a public PII
  endpoint. Decision: a per-order **access cookie** (`order_access_<number>`, value =
  HMAC-SHA256 of the order number with the session secret, httpOnly, 30 d) is granted by
  the checkout Server Action; the page renders details only with that cookie or for a
  signed-in admin. Everyone else sees number + status and a **e-mail confirmation form**
  (case-insensitive compare against the order's e-mail, throttled 10 failures/h per
  order, unknown order and wrong e-mail share one message).
- Rejected alternatives: login for customers (out of scope), token in the confirmation
  URL (URLs end up in logs/history), showing items but hiding the address (purchase
  history is PII too).
- Regression: `tests/e2e/order-privacy.spec.ts` (stranger sees no address/e-mail in the
  HTML, wrong e-mail rejected, correct e-mail unlocks, cookie persists) +
  `tests/order-access.test.ts` (token binding to the exact order number, throttle).

### #4 — admin password: no source-code constant, no reset, no on-screen credentials
- The seed no longer writes a fixed password: `ADMIN_PASSWORD` env wins, otherwise a random
  one is generated and printed **once** at creation; a re-seed never touches an existing
  admin's password (`$setOnInsert`). The login page shows the demo hint only in development
  builds (`NODE_ENV !== "production"`), and the dashboard has a „Passwort ändern" form
  (`changePasswordCore` — verifies the current password, ≥ 10 chars) so there is a way to
  change it. e2e seeds pass `ADMIN_PASSWORD` explicitly.

### #5 — login throttle cannot be bypassed with X-Forwarded-For
- The throttle always keys on the **account** (`acct|email`) in addition to IP+account, so
  rotating spoofed headers cannot buy more guesses. `X-Forwarded-For`/`x-real-ip` are only
  consulted when `TRUST_PROXY_HEADERS=true` (deployment behind our own proxy), and then the
  **last** XFF entry is used — the address our proxy appended; earlier entries are
  client-controlled. Without that env every request shares one IP bucket and only the
  account limit applies.
- scrypt (32 MiB/verification) runs through a limiter (`src/server/limiter.ts`, 2 parallel,
  queue 8, then a German busy error), so parallel scripted logins cannot exhaust the server.

### #6 — logout revokes the session server-side
- Tokens carry `iat`; the user document carries `sessionsInvalidBefore`. Logout (and a
  password change) sets `sessionsInvalidBefore = now`, so every token issued before that
  instant is dead everywhere — a captured cookie from the LAN's plain-HTTP mode stops
  working immediately. `resolveSessionUserId` enforces it (the proxy stays a signature-only
  fast gate without DB access; pages/actions do the full check).
- Chosen over a per-session collection: one field, no join, and "sign out everywhere" is
  exactly the semantics we want for logout and forced sign-out.

### #7 — security headers and the Secure-cookie protocol decision
- `next.config.ts` sends on every response: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` +
  `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'` (nothing on the site
  is framed; a full script CSP is omitted deliberately — Next/PPR inline scripts would need
  nonces and the app has no user-generated HTML injection surface), HSTS, and
  `poweredByHeader: false`.
- `x-forwarded-proto` is only consulted for the cookie's `Secure` flag when
  `TRUST_PROXY_HEADERS=true` — Next fills it with `http` itself when a TLS proxy does not
  send it, which silently stripped `Secure` on https sites. Otherwise the browser's own
  Origin/Referer scheme decides (BUG1 behavior preserved), then the NODE_ENV default.

### #8 — checkout abuse limits
- Per order: ≤ 20 lines, ≤ 10 per line, ≤ 10 per SKU **after merging** duplicate SKUs
  (schema-level, so client and server agree). Per client: 10 orders per 10 minutes
  (`createRateLimiter`, fixed window, keyed like the login throttle — without a trusted
  proxy all clients share one bucket, which is still far above human demo usage).
  `createOrderCore` itself stays unthrottled for integration tests.

### #9 — every Server Action validates its input at the boundary
- Shared `objectIdSchema` (`src/lib/validations/common.ts`); all admin actions parse their
  form values through zod (ids must be real ObjectIds, SKU queries are length-bounded
  strings) and answer bad input with the German "Ungültige Anfrage." instead of a 500.
  `searchSkuAction` takes `unknown` and degrades to an empty result.

### #10 — shipped only via label creation
- `packed → shipped` stays in the graph but is **label-only**: `canTransition`/`transition`
  require `{ viaLabel: true }` (only `createLabelCore` passes it), and
  `allowedTransitions` — what the admin UI renders — excludes it. A manual
  "→ Versandt" from `packed` now raises `IllegalTransitionError` ("Dieser Statuswechsel
  ist nicht erlaubt"), so a shipped order can never lack a tracking number.

### #11 — concurrent checkouts back off instead of failing
- Concurrent transactions serialize on the counter document; the loser of a write conflict
  retried immediately (3×) and usually collided again. Retries now use bounded exponential
  backoff with jitter (10 ms doubling, capped 320 ms, 6 attempts), so 10 parallel
  checkouts all succeed (integration test). The number stays minted **inside** the
  transaction — gap-free numbering is kept.

### #12 — checkout prices are verified server-side, never trusted from the cart
- The cart keeps the price from when the item was added, so the displayed total can be
  stale. Instead of silently booking DB prices, every checkout line now carries
  `expectedUnitPriceCents`; `createOrderCore` refuses (before touching stock) when the DB
  price differs and returns the current prices. The form shows a warning and updates the
  cart (`syncPrices`), so the customer always pays exactly what the last displayed total
  showed — or is told prices changed and confirms the new total.

### #28 — real 404 for unknown product slugs via the proxy
- With PPR the page's shell (status 200) is flushed before the page code runs, so
  `notFound()` inside a Suspense-wrapped page can only ever answer 200 (soft 404).
  The slug existence check (indexed field, one `exists` query) therefore runs in
  `src/proxy.ts` — before any bytes are sent — and unknown slugs get a real HTTP
  404 (rewrite to `/_not-found` with `status: 404`). The product page dropped its
  `Suspense` wrapper so `notFound()` in the page itself still works as defense in
  depth. Proxy is Node.js runtime (Next 16 default), so the DB call is allowed.

### #34 — dead code policy and knip
- `knip` (exact-pinned devDependency, `knip.json`, `npm run knip`) enforces "no dead code":
  exports used only inside their own file lost the `export` keyword, test-only helpers moved
  into the tests (`MOCK_TRACKING_PATTERN`), the unused session re-export barrel, the uncalled
  `POST /api/shipping/label/[orderId]` (with its `isSameOrigin` helper — label creation is the
  Server Action, whose same-origin check Next enforces) and the create-next-app SVGs are gone.
- **Vendored shadcn components (`src/components/ui/**`) are knip-ignored:** they are kept in
  canonical upstream shape on purpose; trimming unused variants would make updates hostile.

### #37 — `generateMetadata` must unwrap the request before any DB access
- Under `cacheComponents`, code in `generateMetadata` runs in the **prerender stage**
  until a dynamic API unwraps it — and `await params` does not. The product page's
  metadata lookup queried MongoDB there, and the driver's internal `new Date()`
  (CMAP monitoring events) tripped Next's "unstable value `new Date()` while
  prerendering" guard on every product page view.
- Rule: every `generateMetadata` that touches the database calls `await connection()`
  first (the product page was the only offender; all page bodies already do). The
  driver-internal `new Date()` is not ours to remove — the fix is to run the query in
  the dynamic stage, where time is allowed.

### Gate recovery — the build never touches the database
- **Every API route calls `connection()` before any data access** (the #37 rule, now
  for routes). `/api/shop-settings` lacked it, so `next build` prerendered it: the
  settings were baked into static JSON (admin edits never reached the storefront) and
  the prerender booted the embedded MongoDB inside a build worker. The pool kills that
  worker without cleanup and mongodb-memory-server's killer process does not reap the
  instance there, so the mongod was orphaned on `data/mongo` — the recurring gate
  failure (`/api/health` 500, `DBPathInUse`, link-less listing). With the route dynamic
  the build touches no database at all: verified by building with no mongod running and
  seeing none left behind.
- Guarded by `tests/api-routes-dynamic.test.ts` (static check over `src/app/**/route.ts`,
  same style as the lib-purity guard); an intentionally static route would need an
  explicit exception there.

### #38 — LAN run: `.env.local` + `npm run setup:lan` instead of hand-set secrets
- Production requires `SESSION_SECRET` (#2) and the admin password is no longer a
  source-code constant (#4) — together that made the LAN shop unstartable and the
  login unrecoverable. The repeatable answer is `npm run setup:lan`: it ensures
  `.env.local` (gitignored, mode 600) contains a generated `SESSION_SECRET` (48 random
  bytes) and `ADMIN_PASSWORD`, seeds with them and prints the login. Idempotent —
  existing values are never changed, so the printed password stays the valid one.
- `.env.local` is the single secret source: `next start` loads it natively; the tsx
  scripts load it via `scripts/load-env.ts` (`process.loadEnvFile`, which — like
  `--env-file` — lets already-set variables win). No dotenv dependency, no secrets in git.
- An admin that already exists keeps its password (re-seeds never touch it, #4/#14);
  if that password is unknown from a pre-#38 setup, `npm run seed -- --fresh` is the
  documented reset.

### #39 — customer portal: scoped sessions, e-mail as identity, dev outbox for reset mails
- **Separate scopes, separate cookies.** `SessionPayload` gained `scope: "admin" |
  "customer"` (missing = admin, so old tokens stay valid for admins only). Admin and
  customer sessions live in different cookies (`admin_session` / `customer_session`), the
  login check is role-scoped (`authenticate(email, password, role)`), and
  `resolveSessionUserId(token, scope)` requires token scope **and** user role to agree —
  a customer cookie can never open `/admin` and vice versa, in the proxy as well as in
  every page/action. Customer sessions last 30 days (a portal login should survive a
  restart of the demo), admin sessions stay 12 h.
- **E-mail is the identity.** Orders link to the account via `userId` when ordered logged
  in; guest orders become visible to the account with the same e-mail, and the portal's
  "Bestellung hinzufügen" form claims them after the buyer proves that e-mail. The pure
  rule (`src/lib/order-visibility.ts`): a linked order belongs to its linked account only;
  an unlinked order is visible to the account with the matching e-mail.
- **Registration reveals taken e-mails on purpose.** Password reset deliberately does
  not (constant sentence, token only for real accounts). A sign-up form that hides a
  duplicate address only hurts real users; this trade-off is the industry default.
- **Reset links are single-use hashes.** 32 random bytes, only the SHA-256 stored
  (`password_resets._id`), 1 h TTL index, `usedAt` marks consumption, a successful reset
  revokes all sessions (`sessionsInvalidBefore`) and deletes the user's other tokens.
- **Mails go to the dev outbox for now.** `sendMail` stores every message in
  `mail_messages` and the admin sees them under `/admin/mails` — without it the reset
  flow would be untestable. The transport interface and the remaining templates are
  issue #44's scope.
- **Checkout keeps the guest path.** Logged-in customers order with a prefilled form and
  their orders carry `userId`; guests check out exactly as before (plus the claim option
  afterwards). No forced registration.

### #40 — invoice payment: state machine context, credit inside the transaction, demo QR-bill
- **The payment method is part of the transition context.** Invoice orders must be
  packable/shipable before the money arrives, so the state machine gained `new → picking`
  — legal **only** with `paymentMethod: "invoice"` (a card order skipping `paid` would ship
  unpaid). Conversely `new → paid` of an invoice order only passes with
  `viaInvoicePayment: true`, so the plain admin button cannot mark an invoice "paid"
  without an amount; `allowedTransitions(from, { paymentMethod })` hides exactly those
  edges from the buttons. The alternative (a separate `unpaid` status) was rejected — it
  would fork every downstream status check.
- **Credit is checked inside the checkout transaction.** `createOrderCore` sums the
  account's open invoice amounts (`getInvoiceCreditUsageCents`, same session) and refuses
  over the limit (`user.creditLimitCents`, default CHF 1'000.00) — a pre-transaction check
  would race two parallel checkouts into double the credit. Guest invoice checkout is
  refused with a German error, not silently downgraded.
- **Partial payments settle explicitly.** `paidCents` accumulates; only the full amount
  sets `payment.paidAt` and (for a still-unpaid order) moves it to `paid` through the
  state machine. An overpayment is refused rather than booked as credit.
- **Reminders are dated fields, not a job.** `reminder1At`/`reminder2At` on the order;
  the admin clicks "1./2. Mahnung", the core enforces overdue-only, 2-after-1, once each
  (conditional write on the empty field), and the mail goes to the dev outbox. A cron
  would be untestable overkill for this demo.
- **QR-bill is a faithful demo, not a working payment.** The PDF embeds a real Swiss QR
  Code (SPC payload, ISO 11649 QRR reference with ISO-7064 mod 97 check digits — pure and
  unit-tested in `src/lib/invoices.ts`) but with the shop's own IBAN placeholder; no
  postal account exists, so "bezahlt" stays the admin's manual mark.
- **Invoice PDFs live in `data/invoices/`** (outside the web root, like labels) and are
  generated on demand; served only by the two guarded routes (admin session, or the
  order-visibility rule behind `/bestellung/…/rechnung`).

### #41 — pickup: two new statuses instead of a parallel order kind
- **`ready` and `picked_up` are real order statuses, gated by the shipping method in the
  transition context.** The alternative (a boolean flag on the parcel statuses) would
  have forked every downstream check ("packed but actually at the counter?"). Instead
  the state machine separates the chains: pickup orders never enter
  `packed/shipped/delivered`, parcel orders never enter `ready/picked_up`, and the
  shipping method must be in the context for either chain to move — a default (parcel)
  context cannot accidentally open the pickup edges.
- **`ready → picked_up` is handover-only** (like `packed → shipped` is label-only, #10):
  it records the payment (cash/card, `payment.paidAt` if still unpaid), so it belongs to
  the pickup queue's handover action with the code check, never to the status buttons.
- **The handover code is a convenience, not a secret.** 6 unambiguous characters
  (no O/0/I/1), shown on the confirmation, in the portal and in the admin queue; plain
  equality after normalization. It prevents handing the wrong parcel to the wrong
  person at the counter — it authenticates nothing (the order number is equally public).
- **Pickup payment only with pickup shipping; invoice never with pickup.** Enforced in
  `checkoutSchema`: „bei Abholung“ is paid at the counter, and the invoice credit/
  reminder flow assumes a parcel workflow with a shipping address.
- **The customer chain skips `picking`** (`new → ready → picked_up`): an order may be
  marked ready directly from `new`, and a milestone chain must not contain a step that
  can be skipped.
- **Cancelling a `ready` order restocks** — the goods never left the shop.

### #45 — discount codes: redemption inside the checkout transaction
- **The code is checked and redeemed inside the order transaction, not before it.**
  The usage-limit increment is a conditional `$inc` (`usedCount < usageLimit`) and the
  once-per-customer rule is a unique `_id` (`code|customerKey`) — the loser of a race
  modifies 0 documents / hits the duplicate-key error and the whole order aborts, so a
  limit can never be exceeded and a failed order never burns a redemption (the
  transaction is the rollback, same rule as the stock decrement).
- **customerKey is the userId when logged in, else the lower-case e-mail.** The e-mail
  is what checkout already requires and what the #39 claim flow proves, so the rule
  works for guests and accounts without a new identity concept.
- **The discount lowers the taxable gross.** VAT is computed over the discounted total
  (`vatFromGross(total − discount)`), consistent with the gross-price rule (§8): the
  customer pays 8.1 % VAT on what they actually pay.
- **The cart only remembers the code; the server owns the truth.** The client shows the
  reduction from a feedback call (`validateDiscountAction`), but `createOrderCore`
  re-validates and recomputes it against the DB subtotal — a tampered or stale client
  value can never change the booked price. The normalized code is part of the #15
  idempotency fingerprint: the same cart with and without a code are different
  submissions.

### #46 — wishlist: local store as working copy, account as the mirror
- **The browser store is the truth for the visitor; the account document is the copy
  it syncs into.** Guests keep `wishlist:v1` in localStorage only; while a customer
  session exists, `WishlistSync` mirrors it: one **merge** on mount (local items join
  the stored ones, local order wins — this is the login sync that makes the wishlist
  survive logout/login), a **replace** on every later local change. A response is only
  applied while nothing changed locally since it was sent, so a toggle during a
  round-trip is never clobbered. No server round-trip per heart click.
- **Synced content is slugs, never prices or DTOs.** The server re-resolves them
  against the products collection (unknown slugs are dropped), so the account copy can
  never hold stale prices or point at deleted products.
- **"Zuletzt angesehen" stays local.** It is browsing history of *this* browser, not
  account data — no model, no sync; the rail fetches the products from
  `GET /api/recently-viewed?slugs=…` (≤ 12 slugs, order preserved, unknown skipped).
- **Back-in-stock alerts notify at most once per sell-out.** One document per
  (`sku`, lower-case e-mail) with `_id = sku|email` (idempotent subscribe); the
  restock hook (`notifyRestockedCore` after goods receipt and after a cancel restock)
  stamps `notifiedAt`, so a second restock does not mail again — a new sell-out needs
  a fresh subscription. The mail goes through the #44 transport and never fails the
  workflow it hangs on (same rule as every other workflow mail).

### #47 — reviews: purchase-proven, moderation-gated, rating denormalized
- **A review requires a real purchase.** The buyer must own an order containing the
  product whose status counts as purchased (pure `countsAsPurchase`: everything
  except `new` and `cancelled` — an unpaid invoice/pickup order or a cancelled one
  proves nothing). The check runs server-side on submit; the UI only hides the form.
- **One review per (product, buyer)** — unique `{ productId, userId }`; a second
  attempt is a clean German error, the index makes the race safe.
- **Moderation gate: new reviews are `pending`, only `approved` are public.**
  Admin approves, hides (e.g. abuse) and answers. Nothing customer-written renders
  unmoderated; the buyer sees "in Prüfung" meanwhile.
- **The approved aggregate is denormalized onto the product** (`rating.average/count`,
  recomputed on approve/hide): listing cards, `sort=rating` and JSON-LD read one
  field instead of aggregating per request — same denormalization rule as `filter`.
- **`authorName` is copied at submission** — the review keeps the name it was written
  under even if the account changes or the aggregate is re-sorted later.

### #48 — comparison: URL is the truth, selection is local
- **The comparison page reads its slugs from the URL** (`/products/compare?slugs=…`),
  so a comparison is shareable and reload-safe; the localStorage list (`compare:v1`,
  ≤ 4 slugs) only feeds the tray and the link. Unknown/non-smartphone slugs are dropped
  server-side (`comparableProducts`), a selection below two phones shows a German hint
  instead of an empty table.
- **Only comparable types get the toggle** — since #61 the flag is `comparable` on the
  type config (seed: smartphones only), not a `type === "smartphone"` check; shoes/clothing
  have per-type specs that would need their own row sets, and enabling a type is data now.
- **Difference highlighting is a pure rule** (`buildComparisonRows`): a row differs when
  its formatted values are not all equal; the UI tints the row and adds an sr-only
  "(Unterschied)" so the highlight is not color-only.

### #49 — command palette: one search field, links as results
- **The palette reuses the #42 picker dialog** (type-to-search, ↑/↓, Enter, Esc,
  focus trap) with a new `minChars` option (1 for the palette, 2 for pickers) —
  one keyboard implementation, not two.
- **Results are plain links** (`PaletteHit.href`): orders → detail, products → edit,
  customers → detail, suppliers → `?edit=`. The palette navigates, it never mutates.
  Local hits (the ADMIN_NAV pages, „Neue Einkaufsbestellung") match instantly
  client-side; entity hits come from one server action (`commandSearchAction`,
  admin session + zod-guarded like the picker searches, ≤ 5 hits per group).
- **`?` only fires outside form fields** (input/textarea/select/contenteditable),
  so typing a question mark stays possible; the sidebar shows both hints.
- **The picker content unmounts as soon as `open` goes false** — Radix keeps it
  mounted through the exit animation, which let a quick ⌘K reopen carry the old
  query over (found by the e2e); the conditional mount makes every open fresh.

### #61 — catalog types, dimensions and facets are data
- **`product_type_configs` is the single source** for product types, their variant
  dimensions, facet flags/order rules, labels, positions, brands, the comparison flag
  (`comparable`), the stock model (`stockTracking`) and the image-prompt subject
  (`photoNoun`). `DEFAULT_CATALOG_TYPES` in `src/lib/catalog-types.ts` is only the
  **seed content** of that collection; generic code never names a type. Adding a
  fourth type with its own attributes needs no code change (proven by the runtime
  fourth-type integration test).
- **`Product.attributes` and `Product.filter` became Mixed** keyed by dimension key
  (`filter.color`, not `filter.colors`) — a fixed sub-schema cannot describe dimensions
  that only exist as rows. The validation the schema lost is enforced in the cores
  (`updateVariantCore` checks the attribute keys against the type's dimensions;
  `updateProductCore` never changes `type` — there is no admin path that sets it);
  the seed repairs documents still in the old shape.
- **Facet indexes are per seed dimension key** (`filter.color|size|storage|material`);
  a dimension added at runtime queries unindexed — fine at catalog size (hundreds of
  documents), documented rather than over-engineered with wildcard indexes.
- **The seed inserts type configs insert-only** (#14 rule): a re-seed never clobbers
  admin edits to a type; an empty collection falls back to the seed content so the
  app works before the first seed.
- **`lib/brands.ts` retired** — brands live on the type configs; the mega-menu, the seed
  and the sync test all read the same rows (#31's single-source rule continued).
- **`photoNoun` on the config replaces the last hard-coded type map** (the image
  prompt's `VIEW_NOUNS`): a runtime-added type carries its own English photo subject.

### #64 — VAT, shipping prices and payment methods are data
- **One `shop_settings` document** (key `"shop"`) holds the commerce rules: VAT rate,
  free-shipping threshold, shipping methods (price, `storePickup` flag, hint) and payment
  methods (`kind: immediate | invoice | on_pickup`). `DEFAULT_SHOP_SETTINGS` in
  `src/lib/shop-settings.ts` is only its **seed content**; every rule question goes through
  `getShopSettings()`, writes through the validated `saveShopSettingsCore` (never the last
  active shipping or payment method — the checkout cannot be configured into a dead end).
  Changing a price, the VAT rate or the method set needs no code change (proven by the
  checkout integration test and the admin-edit e2e).
- **Orders carry the flow, not the config.** Checkout stores the chosen method key plus the
  flags the workflow routes on (`shipping.storePickup`, `payment.kind`), so the state
  machine reasons about *behavior* (`storePickup`, `processBeforePayment`, `payAtHandover`)
  and never needs the configuration — a method retired later still transitions its old
  orders correctly. Labels for a retired method fall back to the stored key.
- **The carrier service level is a behavior flag too (#62 review).** The shipping-method
  config row gained `expressService` (checkbox in the settings editor, like `storePickup`);
  checkout stores it on the order (`shipping.expressService`) and `createLabelCore` picks
  `express`/`standard` from that stored flag — a method key never appears in the label
  path, so a renamed or newly configured express-like method ships express without a code
  change. Orders (and `shop_settings` documents) written before the flag existed read
  back as `false` and ship standard, exactly like today's non-express orders; the demo
  express row gets the box ticked via the seed content or a `--fresh` seed.
- **The storefront reads the settings client-side** through `ShopSettingsProvider`
  (`GET /api/shop-settings`, `public, max-age=60`) so the static shell survives
  `cacheComponents`; a browsing tab can therefore lag an admin edit by up to a minute —
  acceptable for rule copy, the server validates and prices every write and order anyway.
- **The catalog-type editor** (`/admin/catalog-types`) writes through #61's
  `saveCatalogTypeCore` guards; the seed hands out the **stored** configs (#64 review), so
  the filter repair derives from the rows an admin may have changed, not from the defaults.

### #63 — code and public URLs are English; German is content only
- **Route segments follow the code, not the content language.** The German-URL `rewrites`
  (the old decision above) made the public URLs a second, German-only naming system
  layered over English code — every link, spec and doc had to know both. Routes are now
  named in English like everything else (`/konto/profil` → `/account/profile`,
  `/bestellung/:number` → `/orders/:number`, `/produkte/vergleichen` →
  `/products/compare`); German stays the base language of **content** only
  (REQUIREMENTS "English code, German content").
- **The old German URLs answer `308` from `next.config.ts` `redirects()`** — the mapping
  is pure configuration, not code paths or middleware logic; `308` (not `301`) keeps the
  method and body on non-GET traffic (the invoice PDF route included). Bookmarks and
  search-engine entries for the pre-#63 URLs land on the exact English target.
- **The proxy 404 gate moved with the routes** (was #34): unknown `/products/<slug>`
  still answers a real HTTP 404 via a rewrite to `/_not-found`, now on the English path;
  the redirect rules run before it, so a German URL never hits the slug check.
- **#58 will prefix the language in front of the English paths** (`/fr/account/profile`) —
  the path segments stay English in every language; only the prefix is added, so this
  decision and the redirect mapping need no change when the languages arrive.
- **Proven by e2e** (`tests/e2e/english-urls.spec.ts`): every former German URL is
  requested without following redirects and must answer `308` with its exact English
  target in `Location` (query preserved); `200` is checked directly on `/products`, and
  guest `/account` must `307` to `/account/login` — the spec fails on the pre-#63 build.

### #62 — serial-number stock and derived incoming stock
- **Serial vs quantity is the type config's `stockTracking` (#61), nothing else.**
  `serialTrackedTypes()` drives goods receipt, checkout reservation and the editor rule;
  a new serial-tracked type needs no code change, shoes/clothing stay quantity.
- **The unit ledger (`stock_units`) is the truth for serial types; `variant.stock` stays
  the derived count of `in_stock` units.** Every quantity reader (listing, stock
  indicator, dashboard) keeps working unchanged. Consequence: `updateVariantCore`
  **refuses direct stock edits** on serial-tracked variants — goods receipt and orders
  are the only writers, so count and ledger can never drift apart.
- **Reservation lives inside the checkout transaction** (one conditional
  `findOneAndUpdate` per piece, `in_stock → reserved` bound to the order number, serials
  recorded on the order line). A missing unit aborts everything exactly like
  `InsufficientStockError`, so the #12/#15 guarantees (price check, idempotency,
  at-most-one-order) hold unchanged; units then travel with the order status moves
  (`packed`/`shipped`/`delivered`/`picked_up`) and a restocking cancel releases them —
  always in the same transaction as the order.
- **Migration:** quantity stock that existed before serial tracking has no serials —
  units start at the next goods receipt. Checkout refuses such legacy stock cleanly
  (`NotEnoughUnitsError` → same German "Nicht genügend Lager" error, nothing written);
  the seed closes the gap by creating a unit per in-stock seeded piece.
- **Serials are customer-linked, therefore admin-only** — ledger page, packing slip and
  invoice PDF; never on public pages or APIs.
- **Incoming stock is derived, never stored twice** (#55): per SKU `Σ (qty − received)`
  over `ordered` PO lines with the earliest `expectedArrivalAt` (set from the supplier
  lead time when ordering, editable per PO). Partial receipts keep the PO `ordered` —
  the remainder *is* the incoming quantity. The shop copy ("N Stk. bestellt, Ankunft
  ca. in 2 Wochen") comes from one pure formatter with coarse day/week buckets, since
  a lead time deserves no more precision than that.

### #58 — one translation table, German base, texts as a language-keyed map
- **`translations` is the single source for every text** (UI, errors, mails, invoices,
  catalog content): one row per key with the required German `de` base and a `texts` map
  keyed by language code. A map, not fixed `fr`/`it`/`rm`/`es` fields, so a sixth language
  is a new map key and a new `languages` row — never a schema or code change.
- **`languages` is data too** (`code`, `label`, `intlLocale`, `position`, `active`); the
  resolver, the switcher and the editor iterate it. `resolveLanguage` precedence is
  URL prefix → remembered cookie → `Accept-Language` (q-values, region stripped) → first
  active language, and values outside the active set never answer.
- **Missing translations fall back to German and are reported**, never hidden: the
  translator collects every key that fell back (or was unknown) into `missingKeys()`,
  which is both the test hook and the admin missing-view source.
- **Rows are process-cached and invalidated on write** (`saveTranslationCore` /
  `saveLanguageCore`), so an edit is live on the next request without a deploy while reads
  stay one DB round-trip per process, not per request.
- **Language rows are deactivated, never deleted** (same discipline as suppliers): a row
  with `active: false` stops answering the resolver and leaves the switcher, but its
  `texts` entries survive, so re-activating a language restores every text at once. The
  admin languages editor exposes `active` as a checkbox and gives a row no delete.
- **A translation save updates `texts` per code, never wholesale (#58 review).** The
  editor shows *all* languages (inactive ones marked `(deaktiviert)`) and submits every
  rendered code with its raw value; `saveTranslationCore` `$set`s each non-blank
  `texts.<code>` and `$unset`s each blank one, while codes absent from the payload stay
  untouched. A partial payload therefore cannot destroy the texts of the languages it
  did not send — deactivating a language and then editing any row keeps that language's
  texts, which is what the deactivate-not-delete decision above promises.
- **The language is the first URL segment of every storefront route (#58 step 2).** All
  storefront routes moved under `app/[lang]` (`/de/products`, `/fr/account/profile` — the
  path itself stays English in every language, #63); the proxy resolves the language
  (prefix > `lang` cookie > `Accept-Language` > first active row), 307-redirects prefix-free
  paths with the query preserved and refreshes the cookie on prefixed **document
  navigations** (`Accept: text/html`) — late RSC prefetch responses of stale prefixes must
  not overwrite a fresh choice — so the choice is remembered. A proxy *rewrite* was rejected: it would make the root layout
  dynamic and kill the PPR shell. Two root layouts replace the single one (`app/[lang]`
  storefront with `<html lang>` + `generateStaticParams` from the seeded language codes,
  `app/admin` prefix-free with `<html lang="de">` and noindex); the admin gets its language
  switcher once its strings live in the table (step 3). The proxy's gates (admin, account,
  product-slug 404) run on the stripped path, and public files (paths with an extension —
  the generated photos share the `/products/` prefix since #63) pass through untouched.
- **hreflang comes from `generateMetadata`, fed by a proxy request header (#58 step 2).**
  Metadata cannot see the current path without opting every page out of prerendering, so
  the proxy passes the stripped path as `x-localized-path` and the `[lang]` layout builds
  `alternates.languages` over the active rows plus `x-default` → default language behind
  `connection()` — the shell stays static and the metadata streams. Rendering the links
  from a client component was tried and rejected: they only reach the flight payload, not
  the crawler-visible HTML.
- **Formats are the language row's `intlLocale`, not a code constant (#58 step 2b).**
  `src/lib/format.ts` is a pure factory: `createFormatters(intlLocale)` builds one cached
  `Intl` set (CHF currency, long dates, date+time, weight, plain number) per locale, so
  every storefront render writes amounts and dates the way its language writes them
  (de-CH "CHF 1'234.50", fr-CH "1'234.50 CHF", es "1234,50 CHF"). Client components read
  the formatters from a `LocaleFormattersProvider` in the storefront layout — initialised
  from the seed configuration of the URL's language (identical on server and client, no
  hydration flicker) and synced to the live row by a `LocaleSync` inside a dynamic hole,
  so an admin edit of `intlLocale` takes effect without a deploy; server components use
  `getIntlLocale(lang)` + `createFormatters` directly. The named exports (`formatChf` and
  friends) stay the **base-locale** formatters of the German-based side (admin, mails,
  invoices) until step 3 moves their strings into the table. A per-request rewrite of the
  formatters through module state was rejected: it would race between requests.
- **UI texts reach components as a resolved label map, not as a live translator
  object (#58 step 3).** `getLabels(lang)` turns the whole table into one plain
  key→text map (German fallback already applied) that a server slot hands to client
  components as a serializable prop — no second round-trip, no context fetch, no way
  for a client component to see another language's base text. `label(map, key)`
  answers an unknown key with the key itself (visibly missing, like the translator),
  and `interpolate(text, { vat, year, … })` fills `{placeholder}` values so texts
  stay whole sentences per language while the values stay data. A client-side
  translator context fed by an API was rejected: it would flash German (or raw keys)
  on every first paint.
- **Deep client trees read the label map from a provider, not from props (#58 step 3).**
  Product cards render on five pages, rails fetch their products client-side, and the
  listing shell threads texts through six children — prop-drilling a map everywhere
  would touch every call site. `LabelsProvider` in the storefront layout follows the
  accepted `LocaleFormattersProvider` shape: initialised from the seed configuration of
  the URL's language (pure, identical on server and client, so the static shell
  prerenders with the right texts) and synced to the live table by a `LabelsSync`
  inside a dynamic hole — an admin edit takes effect without a deploy. This is not the
  rejected API-fed context: the value is server-rendered in the layout, never fetched.
  Outside the provider (the German admin) the context answers the base-language seed
  map. Server components keep calling `getLabels(lang)` and pass the map where they
  render text themselves. With this the stock sentence and the incoming-stock buckets
  moved out of `lib/stock`/`lib/purchasing/incoming` into table keys — the libs keep
  the computation and take the label map as a parameter.
- **Every seeded key ships translated in every seeded language** — a unit test walks
  `DEFAULT_TRANSLATIONS` × `DEFAULT_LANGUAGES` and fails on any missing text, which
  is the #58 "missing translations fall back visibly in tests" check for seed content.
- **Plural forms are a key family resolved through `Intl.PluralRules`, never a code
  branch (#58 step 3).** Count texts live as suffixed rows (`key.one`, `key.other`, …)
  and the pure `plural(labels, count, key, intlLocale)` helper picks the CLDR category
  of the count in the language row's Intl locale, falling back to `key.other`. A
  `count === 1` branch was tried and rejected: it is wrong for the CLDR cases where
  fr/it select "one" for 0 and cannot serve a language with `two`/`few`/`many`
  categories by adding rows. Client components without a locale prop read the locale
  from `useIntlLocale()` — the same live row the formatters use.
- **Renamed code-owned translation keys are retired by a fixed seed migration
  (#58).** The seed is insert-only (#14), so a rename would leave the old row as dead
  data in the one table. `RETIRED_TRANSLATION_KEYS` in `lib/i18n` lists exactly the
  replaced keys and the seed's `retireTranslations` step deletes exactly that list —
  a documented migration of code-owned keys, not a general delete; admin-authored
  keys are never touched.
- **The registration rate limit is configuration (#58).** The e2e suite legitimately
  registers one account per authenticated spec from a single IP, which exhausted the
  hard-coded 5/h window as soon as a new portal spec arrived. `createRateLimiter` in
  `server/customers.ts` now reads `CUSTOMER_REGISTER_LIMIT_PER_HOUR` (default 5 —
  production behaviour unchanged); the e2e global setup raises it for its own server.
  A ceiling the suite has to budget around is a missing configuration, not a test bug.
- **Steps:** step 1 (tables, resolver, cached loader, insert-only seed), the admin
  editor, step 2's routing/switcher/hreflang, step 2b's locale-parameterized formats
  and step 3's first slice (label plumbing + header/footer chrome) are done; the rest
  of the string extraction with the no-German-literals guard, the catalog content and
  the two-language checkout e2e follow in the remaining steps.
