# coder-shop — requirements

A production-grade e-commerce system, built from scratch in this repository. Whoever works on
it works fully autonomously: never ask questions; when something is unspecified, choose the
professional default and record the decision in docs/DECISIONS.md.

STACK — one full-stack TypeScript app on Node.js, frontend and backend together, everything on
the newest stable release (look each one up with `npm view <pkg> version`; never guess or use
an older major): Next.js (App Router, Server Components, Server Actions, route handlers),
React (newest), TypeScript strict, Tailwind CSS (newest major) + shadcn/ui, Framer Motion
(motion), Zod, Vitest, ESLint flat config. The storefront must feel like a single-page app:
client-side navigation, filters/sort/pagination update instantly without full reloads (URL
state), cart drawer and quick actions without page changes, prefetching, transitions.

DATABASE — NoSQL, starting as easily as SQLite: MongoDB with Mongoose (typed schemas, indexes
for the filters and search). Locally the app needs no installed database: mongodb-memory-server
runs a real mongod from node_modules with a persistent data directory (./data/mongo); a single
connection helper starts it on demand when MONGODB_URI is not set, and uses MONGODB_URI when it
is (production). Tests use their own throw-away instance. Model products with embedded
variants and image lists (document-oriented, not a relational schema in disguise).

Node.js 24 is installed. UI language German, currency CHF (formatted de-CH), Swiss VAT 8.1 %
included in prices.

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
weights. Every product has 1–5 images.
IMAGES must look like real product photography — studio product photos on a clean background,
one image per view (front, side, back, detail, lifestyle), matching the product type and each
variant's colour; no drawings, icons or cartoon SVGs. They are generated locally with the image
model on the LLM server: POST http://192.168.10.210:8080/v1/images/generations (OpenAI images
API: prompt, size "768x768", seed; Authorization: Bearer $LLAMA_API_KEY from the environment),
by an idempotent script (scripts/images/) that skips images already on disk, writes WebP/JPEG
under public/products/, and records the paths on the product documents. No brand logos or
trademarks in prompts. Generated images are not committed (Qwen-Image is licensed for
non-commercial research use only). Until they exist, the storefront shows a neutral placeholder.

QUALITY: domain logic (pricing incl. VAT, stock reservation, order state machine, shipping
weight) in src/lib with Vitest unit tests. `npm run build`, `npm run lint` and `npm test` must
pass at the end of every milestone.

CODE QUALITY AND STRUCTURE — clean code is a requirement, not polish:
- A clear, conventional folder structure: src/app (routes only, thin), src/components (ui/ for
  shadcn primitives, shop/ and admin/ for feature components), src/server (data access, server
  actions, providers), src/lib (pure domain logic, no I/O), src/models (Mongoose), scripts/
  (seed, image generation), tests next to what they test or under tests/. Documentation lives
  in docs/ (REQUIREMENTS, ARCHITECTURE, PLAN, REVIEW, DECISIONS, PROGRESS); the root holds only
  README.md and tool configuration.
- Small, single-purpose modules and functions; names that say what things are; no dead code,
  commented-out code, TODO leftovers, debug output, unused files, dependencies or exports;
  no copy-paste duplication; types instead of `any`; errors handled where they can be handled.
- Generated or runtime files (data/, .next/, coverage, logs) never committed; .agent/ belongs
  to the lead (prompts and logs of this run) — leave it untouched.

DELIVERY: milestones M1–M5 (scaffold + data + seed; storefront; cart + checkout; admin orders +
packing + UPS label; purchasing + dashboard + polish). After each one `npm run build`,
`npm run lint` and `npm test` pass, docs/PROGRESS.md is updated (done / open / known issues), and a
git commit "M<n>: …" is made. Never start a long-running server in the foreground; to check
pages, start it in the background, curl it, and stop it again.

PORTAL, PAYMENTS AND MORE (phase 2; each item is a GitHub issue with its acceptance criteria):
- Requested by the user: customer portal with registration, login, order history, order status
  and tracking; payment on invoice with open invoices (Swiss QR-bill); payment on pickup;
  a keyboard-driven picker dialog for articles and suppliers in purchasing (type to search,
  arrows, Enter selects, Esc cancels).
- Ideas of the lead: customer accounts in the admin; e-mails for every step with a dev
  outbox; discount codes; wishlist, recently viewed and back-in-stock alerts; product reviews
  from verified buyers; smartphone comparison; an admin command palette with shortcuts.
