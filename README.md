# coder-shop

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
70 shoes / 60 clothing), 1–5 generated SVG images per product in `public/products/`,
clock-relative order dates, same order numbers on every run.

## Test

```bash
npm test    # Vitest: unit tests (pure src/lib) + integration tests against a throw-away
            # in-RAM replica set started by src/test/setup.ts
npm run lint
npm run build
```

## Admin credentials

Seeded admin user (M4 wires the login UI): `admin@codershop.ch` / `Admin!2026`.

## Database lock recovery

If a previous run crashed, mongod may leave `data/mongo/mongod.lock` behind and startup fails
with a lock error after 3 retries. Recovery: stop any running dev/seed process
(`pkill -f "next start"; pkill -f mongod`), delete `data/mongo/mongod.lock`, start again.

## mongod binary

The mongod binary version is pinned via the `mongodb-memory-server` block in `package.json`
and cached in `.cache/mongod/` (gitignored), so runs after the first download are offline.
If auto-detection of your distribution fails, set `MONGOMS_SYSTEM_BINARY=/path/to/mongod`
to use a locally installed mongod instead.
