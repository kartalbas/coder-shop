You are building a production-grade e-commerce system from scratch in this git repository
(it holds only this file, opencode.json and .gitignore). Work fully autonomously: never ask
questions; when something is unspecified, choose the professional default and record the
decision in DECISIONS.md.

STACK — one full-stack TypeScript app, frontend and backend together, on the most modern
stable versions (check with `npm view <pkg> version`, do not guess): Next.js (App Router,
Server Components, Server Actions, route handlers for APIs), TypeScript strict, Tailwind CSS +
shadcn/ui, Framer Motion, Zod, Vitest.

DATABASE — NoSQL, starting as easily as SQLite: MongoDB with Mongoose (typed schemas, indexes
for the filters and search). Locally the app needs no installed database: mongodb-memory-server
runs a real mongod from node_modules with a persistent data directory (./data/mongo); a single
connection helper starts it on demand when MONGODB_URI is not set, and uses MONGODB_URI when it
is (production). Tests use their own throw-away instance. Model products with embedded
variants and image lists (document-oriented, not a relational schema in disguise). Node.js 24 is installed. UI language
German, currency CHF (formatted de-CH), Swiss VAT 8.1 % included in prices.

STOREFRONT — modern, premium UX (think Apple Store / Zalando quality):
- Home with hero, featured collections, category tiles; header with mega-menu, instant search
  (debounced, keyboard navigable), cart drawer with item count badge.
- Category/listing pages with faceted filters per product type (smartphones: brand, storage,
  color; shoes: brand, EU size, color; clothing: brand, size XS–XXL, color, material),
  sorting, pagination, skeleton loading, empty states.
- Product page: image gallery with 1–5 images (thumbnails, swipe, zoom), variant picker that
  updates price, stock and image, stock indicator, related products, breadcrumbs, structured
  data (JSON-LD).
- Cart (persisted), checkout (address, shipping method, mock payment), order confirmation.
- Responsive (mobile first), dark mode, accessible (semantic HTML, focus states, aria),
  subtle animations, optimistic UI where it helps.

ADMIN (/admin, login with a seeded admin user; credentials in README):
- Dashboard: revenue, open orders, low-stock alerts.
- Products: list, search, edit (incl. variants, stock, images).
- Purchasing: suppliers, purchase orders (draft → ordered → received); receiving goods
  increases variant stock.
- Order intake: list with status filter; status workflow
  new → paid → picking → packed → shipped → delivered (and cancelled), every transition
  validated and logged with timestamp.
- Packing: pick list per order, packing slip view (printable), parcel weight from variant
  weights.
- Shipping: UPS label creation through a ShippingProvider interface. Implement
  UpsShippingProvider against the UPS REST APIs (OAuth client credentials, Shipping API) used
  only when UPS_CLIENT_ID/UPS_CLIENT_SECRET/UPS_ACCOUNT are set; otherwise a
  MockUpsProvider returns a realistic tracking number (1Z…) and a generated PDF label.
  Creating a label moves the order to "shipped".

DATA: a deterministic seed script with exactly 200 products: 70 smartphones, 70 shoes,
60 clothing items, realistic names/brands/descriptions/prices, variants per type, stock,
weights. Every product has 1–5 images: generate them locally as distinct SVG files
(product-type silhouette, colour per variant, angle/detail variations) under
public/products/ — no external image URLs.

QUALITY: domain logic (pricing incl. VAT, stock reservation, order state machine, shipping
weight) in src/lib with Vitest unit tests. `npm run build`, `npm run lint` and `npm test` must
pass at the end of every milestone.

WORK PLAN — you have about 60 minutes; deliver in this order and keep the app working after
each step:
 M1 project scaffold, MongoDB connection + Mongoose models, seed (200 products + SVG images),
    README (how to start, seed, admin login)
 M2 storefront: home, listing with filters, product page with gallery and variants
 M3 cart + checkout + order creation
 M4 admin login, order intake with status workflow, packing, UPS label (mock)
 M5 purchasing + goods receipt, dashboard, polish (dark mode, animations, a11y)
Write PLAN.md first. After each milestone: run build/lint/tests, fix failures, update
PROGRESS.md (done / open / known issues) and make a git commit "M<n>: …".
Never start a long-running dev server in the foreground; to check pages, start it in the
background, curl it, and stop it again.
