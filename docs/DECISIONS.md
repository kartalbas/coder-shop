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
- English code / German public URLs via `next.config.ts` rewrites; no German stemming in the
  text index.

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
  before `exp` is trusted. Secret: `SESSION_SECRET` env var; when unset a fixed development
  fallback secret is used (documented — dev/demo app with public credentials; production must set
  `SESSION_SECRET`).
- **Login throttle:** in-memory Map keyed `ip|email`, 5 failures per 15 min window, then locked
  until the window ends (ARCHITECTURE §4.4 — acceptable for the single-process deployment).
- **`transitionOrderCore` throws `IllegalTransitionError`** for illegal edges (the state machine
  is the single source of truth; actions map it to a German error message) and restocks
  `new`/`paid`/`picking` cancels inside the same transaction.
- **`createLabelCore`** takes the provider as an optional parameter (defaults to the env-driven
  factory) so integration tests can inject mocks/failures without env juggling; the final
  `packed → shipped` move is a conditional `findOneAndUpdate` on `status: "packed"`, making
  double-clicks converge on the first label.

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
