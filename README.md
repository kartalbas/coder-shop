# coder-shop

> **About this project.** coder-shop is written by a **local LLM** — Qwen3.8-Flash-Next
> (Unsloth UD-Q5_K_XL) on the [Strata](https://github.com/Niko1221/Strata) engine, one RTX 5080
> 16 GB + 128 GB RAM — working through [OpenCode](https://opencode.ai) in a spec-driven run:
> plan, critical review, revision, gated milestones. It is a test of that coder. The full setup,
> method, timeline and an honest evaluation (what it did alone, where it was helped) are in
> [docs/EXPERIMENT.md](docs/EXPERIMENT.md), written by the lead, not by the coder.

Production-grade e-commerce shop — Next.js App Router, TypeScript, MongoDB via Mongoose.
UI German, currency CHF (de-CH), Swiss VAT 8.1 % included in prices. No installed database
required: [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server) runs a
single-node replica set from `node_modules` (persistent in `./data/mongo`, real transactions).

## Run

```bash
npm install
npm run seed   # deterministic demo data (200 products, orders, suppliers, admin user)
npm run dev    # http://localhost:3000
```

`npm run build && npm run start` runs the production server. Set `MONGODB_URI` to use an
external replica-set-capable MongoDB instead of the embedded one (required in production).

## Seed

```bash
npm run seed          # idempotent: upserts catalog, creates sample orders/POs only once
npm run seed -- --fresh  # drop the database first, then seed
```

`--fresh` refuses to run while another process (e.g. the dev server) holds the `data/mongo`
lock. The seed is deterministic (fixed PRNG seed): same 200 products (70 smartphones /
70 shoes / 60 clothing), 1–5 placeholder SVGs per product in `public/products/`,
clock-relative order dates, same order numbers on every run. The seed never resets recorded
photo paths on existing products (`$setOnInsert`) — see the image pipeline below.

## Product photos

```bash
npm run images              # generate all missing product photos
npm run images -- --limit 5 # cap generations per run (resumable)
```

`scripts/images/` generates photorealistic studio photos via the image model on the LLM
server (`POST $IMAGE_API_URL`, default `http://192.168.10.210:8080/v1/images/generations`,
`Authorization: Bearer $LLAMA_API_KEY`), writes WebP files to `public/products/` (gitignored)
and records the paths + German alts on the product documents. Idempotent: slots already on
disk are skipped, drifted document paths are repaired (a pure skip/repair run needs no API
key). Until a photo exists, the storefront shows a neutral placeholder — seed SVGs are never
rendered.

## Test

```bash
npm test     # Vitest: unit tests (pure src/lib) + integration tests against a throw-away
             # in-RAM replica set started by src/test/setup.ts
npm run lint
npm run build
npm run test:e2e  # Playwright (Chromium): full journeys against a production build on
                  # port 3100 with a freshly seeded throw-away database — run `npm run
                  # build` first; never touches ./data/mongo
```

## Admin

`/admin` — login with the seeded admin user: `admin@codershop.ch` / `Admin!2026`.
Dashboard (revenue, open orders, low stock), products (search, edit core data, variants with
price delta/stock/weight/attributes, images, featured toggle), orders, packing + UPS labels,
purchasing (suppliers, purchase orders with goods receipt).

## Environment variables

All optional for local development (sensible defaults / embedded database):

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | External MongoDB. **Required in production** — must be a replica-set-capable URI (core functions use transactions). Without it, the embedded `mongodb-memory-server` replica set is used (dev/seed/test only). |
| `SESSION_SECRET` | Secret for the admin session cookie HMAC. **Set it in production**; unset falls back to a fixed development secret. |
| `SESSION_COOKIE_SECURE` | `true`/`false` to pin the admin session cookie's `Secure` flag. Unset (default) sets it per request from the request protocol (https → `Secure`, plain http → not), so the admin also works from other machines on the LAN over http. See DECISIONS. |
| `UPS_CLIENT_ID` / `UPS_CLIENT_SECRET` / `UPS_ACCOUNT` | Set **all three** to create real UPS labels via `UpsShippingProvider`; otherwise the `MockUpsProvider` generates `1Z…` tracking numbers and PDF labels in `data/labels/`. |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata/Open Graph (defaults to `http://localhost:3000`). |
| `MONGOMS_SYSTEM_BINARY` | Path to a local mongod if the mongodb-memory-server binary download/detection fails. |
| `LLAMA_API_KEY` | Bearer key for the image API used by `npm run images` (only needed when a photo is actually generated). |
| `IMAGE_API_URL` | Image generation endpoint for `npm run images` (defaults to `http://192.168.10.210:8080/v1/images/generations`). |
| `E2E_PORT` | Port for the Playwright e2e run (default `3100`). |

## Database lock recovery

If a previous run crashed, mongod may leave `data/mongo/mongod.lock` behind and startup fails
with a lock error after 3 retries. Recovery: stop any running dev/seed process
(`pkill -f "next start"; pkill -f mongod`), delete `data/mongo/mongod.lock`, start again.

## mongod binary

The mongod binary version is pinned via the `mongodb-memory-server` block in `package.json`
and cached in `.cache/mongod/` (gitignored), so runs after the first download are offline.
If auto-detection of your distribution fails, set `MONGOMS_SYSTEM_BINARY=/path/to/mongod`
to use a locally installed mongod instead.
