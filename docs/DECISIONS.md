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
- English code / German public URLs via `next.config.ts` rewrites; **no text index** — search
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
