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
- Product images are local SVGs: rendered with `<img>` (`next/image` cannot optimize SVGs
  without a custom loader); `@next/next/no-img-element` is disabled for
  `src/components/storefront/**` only.
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
