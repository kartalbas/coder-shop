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

## Run on the LAN (production, repeatable)

```bash
npm run setup:lan   # one-time: creates .env.local (gitignored, mode 600) with a strong
                    # SESSION_SECRET and a known ADMIN_PASSWORD, then seeds the database
npm run build
npm run start -- -H 0.0.0.0 -p 4000   # http://<this machine's IP>:4000
```

Production requires `SESSION_SECRET` (≥ 32 chars) — without it `/admin` refuses to start
sessions. `setup:lan` generates one and keeps it out of git in `.env.local`, together with
the admin password, so the login is always recoverable: the command prints both and is
idempotent (a re-run never changes existing values). `next start` loads `.env.local`
itself; `npm run seed` and `npm run images` load it too (variables already set in the
environment win). The embedded database and the photos in `public/products/` work as
they do locally; over plain http the session cookie is correctly not `Secure` (see
`SESSION_COOKIE_SECURE` below).

## Seed

```bash
npm run seed          # adds missing products/users/suppliers; never changes existing data
npm run seed -- --fresh  # drop the database first, then seed
```

`--fresh` refuses to run while another process (e.g. the dev server) holds the `data/mongo`
lock. Re-running the seed never overwrites shop data (issue #14): products, the admin
user and suppliers are written with `$setOnInsert` only — sold stock, edited prices and
every other admin change survive; sample orders/POs are created only once. Use `--fresh`
for a real reset. The seed is deterministic (fixed PRNG seed): same 200 products (70 smartphones /
70 shoes / 60 clothing), 1–5 image slots per product recorded with their final photo
paths (`/products/<slug>-<n>.webp`), clock-relative order dates, same order numbers on
every run. The seed never resets recorded
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
key). Until a photo exists, the storefront shows a neutral placeholder.

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

`/admin` — login with the seeded admin user `admin@codershop.ch`. Its password is **not** a
source-code constant: `npm run seed` uses `ADMIN_PASSWORD` if set and otherwise generates a
random one, printed exactly once in the seed output. For a recoverable login use
`npm run setup:lan` (stores the password in `.env.local` and prints it). A re-seed never
resets the password of an existing admin; change it later under Dashboard → „Passwort
ändern". The login page shows a demo hint only in development builds, never in production.
Dashboard (revenue, open orders, low stock), products (search, edit core data, variants with
price delta/stock/weight/attributes, images, featured toggle), orders, packing + UPS labels,
purchasing (suppliers, purchase orders with goods receipt).

## Environment variables

All optional for local development (sensible defaults / embedded database):

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | External MongoDB. **Required in production** — must be a replica-set-capable URI (core functions use transactions). Without it, the embedded `mongodb-memory-server` replica set is used (dev/seed/test only). |
| `SESSION_SECRET` | Secret for the admin session cookie HMAC. **Required in production** (≥ 32 characters, e.g. `openssl rand -base64 48` — or just run `npm run setup:lan`, which generates and stores it in `.env.local`); outside production a random per-process secret is generated. |
| `SESSION_COOKIE_SECURE` | `true`/`false` to pin the admin session cookie's `Secure` flag. Unset (default) sets it per request from the browser's own Origin/Referer scheme (https → `Secure`, plain http → not), so the admin also works from other machines on the LAN over http; `x-forwarded-proto` is only trusted with `TRUST_PROXY_HEADERS=true`. See DECISIONS. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used by `npm run seed` only, for the initial admin user. Without `ADMIN_PASSWORD` a random password is generated and printed once; an existing admin's password is never changed by the seed. |
| `TRUST_PROXY_HEADERS` | `true` only when the app always sits behind your own reverse proxy: then the login throttle uses the **last** `X-Forwarded-For` entry (the address your proxy saw). Unset (default), the header is ignored — the per-account throttle limits guesses regardless of spoofed headers. |
| `UPS_CLIENT_ID` / `UPS_CLIENT_SECRET` / `UPS_ACCOUNT` | Set **all three** to create real UPS labels via `UpsShippingProvider`; otherwise the `MockUpsProvider` generates `1Z…` tracking numbers and PDF labels in `data/labels/`. |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata/Open Graph (defaults to `http://localhost:3000`). |
| `MONGOMS_SYSTEM_BINARY` | Path to a local mongod if the mongodb-memory-server binary download/detection fails. |
| `LLAMA_API_KEY` | Bearer key for the image API used by `npm run images` (only needed when a photo is actually generated). |
| `IMAGE_API_URL` | Image generation endpoint for `npm run images` (defaults to `http://192.168.10.210:8080/v1/images/generations`). |
| `SMTP_HOST` / `SMTP_FROM` | Set **both** to deliver workflow mails for real via SMTP (nodemailer); otherwise every mail stays in the dev outbox, readable under `/admin/mails`. |
| `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Optional SMTP details: port (default 587, `465` ⇒ implicit TLS) and login credentials. |
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
