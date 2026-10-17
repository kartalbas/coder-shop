# The experiment behind coder-shop

> Written by the **lead** (Claude, Anthropic — the observer of this run), not by the coder.
> Everything else in this repository — code, ARCHITECTURE, PLAN, REVIEW, PROGRESS, DECISIONS,
> README body — was written by the coder: a local LLM working through OpenCode.

## Why

coder-shop is a test of a **local coding LLM** on a realistic, demanding job: a modern
full-stack shop with a real admin backend (purchasing, order intake, packing, UPS labels),
200 products of three kinds with 1–5 images each, NoSQL data, current tooling. The question is
how far a model that runs entirely on one desktop PC gets, on its own, in about an hour — and
where it needs help. The shop is the yardstick, not the goal.

## The LLM setup

| | |
|---|---|
| Model | **Qwen3.8-Flash-Next** (Qwen, 125 B parameters, MoE: 24,576 experts, 10 active per token, 262,144-token context) |
| Quantization | **Unsloth UD-Q5_K_XL** (routed experts Q5_K / Q8_0, 91.6 GiB; 94.55 % the same top token as Q8_0 by Strata's yardstick), revision `38bb39e` of `unsloth/Qwen3.8-Flash-Next-GGUF` |
| Inference engine | **[Strata](https://github.com/Niko1221/Strata) v0.1.44.1** (`296b59d`, one local patch: a metadata-only GGUF shard passes the size check — upstream issues #2505/#2632). Hot experts on the GPU, all experts in RAM, the lookup (PLE) table on the SSD (O_DIRECT), MTP speculative decoding |
| Server settings | context 262,144, KV cache int8 (streamed to RAM, 32,768 tokens resident in VRAM), images on the GPU, OpenAI + Anthropic APIs on the LAN |
| Reasoning effort | **medium** for this run (project `opencode.json`; the server default is high) |
| Coding agent | **[OpenCode](https://opencode.ai) 1.19.0**, headless (`opencode run --auto --format json`), one fresh session per phase |
| Toolchain | Node.js 24.22.0 (nvm), npm |
| Hardware | AMD Ryzen 9 9950X3D (16 cores), 2 × 64 GB DDR5-6000, **NVIDIA RTX 5080 16 GB** (driver 615.71.09, CUDA 13.4), Ubuntu 26.04.1 on a USB 3.2 20 Gbit/s SSD |
| Measured speed | writing ~43–55 tok/s (flat up to 254 k context), prompt reading ~3,100–3,300 tok/s; ~77 % of the MTP-drafted tokens accepted |

The whole machine is set up from configuration with
[setup-ubuntu-ai](https://github.com/kartalbas/setup-ubuntu-ai) (profile
`config.strata-ud-q5kxl.conf`: drivers, CUDA, Strata, the model download, the systemd service,
health checks, benchmarks, a live monitor).

## The method — spec-driven, gated, one session per phase

The lead wrote only [REQUIREMENTS.md](REQUIREMENTS.md) and the phase prompts in
[`.agent/prompts/`](../.agent/prompts). Each phase is a fresh OpenCode session, so no session
carries a full context into the next:

1. **Architecture and plan** — the coder looks up every package version (`npm view`) and writes
   ARCHITECTURE.md and PLAN.md with acceptance criteria that commands can check.
2. **Critical review** — a new session, told to be a strict principal engineer, reviews the plan
   (REVIEW.md).
3. **Revision** — the plan is revised against the review and the lead's notes (layering,
   English identifiers, real MongoDB transactions, docs/ layout, prove the toolchain first,
   time box).
4. **Milestones M1…M5** — one session each; after each one the lead runs a **gate**: build,
   lint, tests, the app's pages. A red gate goes back to the coder as a report.

**Rule for gate reports:** the lead reports *what* fails — the command and its output — never
*why* or *how to fix it*. One exception happened before the rule was set (gate M1 → M1b, see
below) and is counted as assisted.

## Timeline (2026-10-17)

The first hour was observed live; at 02:37 the user went to sleep and the rest ran unattended
through [`.agent/orchestrate.sh`](../.agent/orchestrate.sh): a fresh OpenCode session per
attempt, then an automatic gate (`npm test`, `npm run lint`, `npm run build`, the pages served
by a production build, the listing linking products, no server errors, a "M<n>:" commit,
pushed; for QA also `npm run test:e2e`). A red gate goes to the next session as raw output only.

| Phase | Sessions | Coder time | Gate |
|---|---:|---:|---|
| 1 Architecture + plan | 1 | 4.2 min | — |
| 2 Critical review | 1 | 5.5 min | — |
| 3 Revision + README + first push | 2 | 11.4 min | — |
| M1 scaffold, data, 200-product seed, domain logic | 3 | 27.5 min | green after M1c (M1b had lead hints) |
| M2 storefront (home, mega-menu, search, faceted listing, product page, cart store) | 2 | 44.9 min | green on session 2 |
| M6 photo pipeline (`npm run images`) | 1 | 15.7 min | green on session 1 |
| — image batch: 576 photos, 768×768 WebP, ~5.9 s each | — | 55.6 min | 0 errors |
| M3 cart, checkout (transactions), confirmation | 1 | 15.3 min | green on session 1 |
| M4 admin auth, order workflow, packing, UPS labels | 2 | 49.4 min | green on session 2 (session 1 ran out of time before committing) |
| M5 purchasing, goods receipt, dashboard, polish | 1 | 22.0 min | green on session 1 |
| M6 follow-up (lead's final check: pages still showed SVGs) | 1 | 5.5 min | green |
| 5 Code review of the whole codebase (by the coder) | 1 | 12.6 min | — |
| 6 QA: review fixes + Playwright e2e | 2 | 49.4 min | green on session 2 |
| **Total** | **19** | **≈ 4 h 50 min** of coder sessions, 01:18 → 07:05 | |

Result: 25 commits, ~12,500 lines (without generated UI primitives), 141 source files;
158 unit/integration tests (Vitest, against a throw-away replica set) and three Playwright
end-to-end flows (buying, admin order → UPS label → shipped, goods receipt), all green.
Stack as built: Next.js 16.4.2, React 19.3.1, TypeScript 6.0.3, Mongoose 9.11.2, Playwright 1.64.1.

## What the coder did on its own, and where it was helped

**On its own**
- Verified every package version before planning; a 333-line architecture and a 135-line plan
  with acceptance criteria that are commands; a plan review that found four blockers (Server
  Actions are not curl-able; admin CSRF/session gaps; labels with customer addresses under
  `public/`; an unsafe mongod lifecycle).
- Toolchains newer than its training: shadcn 4 (read `--help`, found the preset), npm's
  install-script approval (approved only the three needed), Next.js 16 Cache Components,
  Vitest 5, Node 24 crypto typings — from raw error output.
- M1–M5 and M6 to green gates; every red gate but one fixed from symptoms only.
- Found the photo bug itself from the lead's symptom report (a re-seed overwrote the recorded
  photo paths; fixed with `$setOnInsert` and repaired the live data) in 5.5 minutes.
- Its own code review of the whole codebase was the strongest single result: it found a real
  **oversell bug** (the stock guard matched the wrong variant — positional array filter instead
  of `$elemMatch`; the test only exercised a copy of the query), that **admin product
  management was missing entirely** although M4/M5 had passed their gates, a double-restock
  race on cancel, `z.coerce.boolean()` turning `"false"` into `true`, unescaped JSON-LD, dead
  code and docs drift — and fixed all of them in the QA phase, with e2e tests to prove the flows.

**Helped by the lead**
- Gate M1 → M1b (before the symptoms-only rule): that `typescript-eslint` does not support
  TypeScript 7, that Next.js 16 rejects the route segment config, that a VAT test expected the
  wrong value. Counted as assisted.
- Lead notes in phase 3 (layering, English identifiers, transactions, docs/ layout, prove the
  toolchain first, time box) — design direction, as a tech lead gives it.
- The requirement change from SVG drawings to photographs, and the photo engine on the server.

**Missed or weak** (counted against the coder)
- "Prove the toolchain first" was in the plan; M1 skipped it, so TypeScript 7 surfaced at the gate.
- A seed failure was hidden by `| tail` (exit code 0); later sessions measured exit codes properly.
- docs/DECISIONS.md gives "7.0.2 is not resolvable" as the reason for TypeScript 6; the real
  reason (typescript-eslint has no TS 7 support) came from the lead.
- Sessions often ran out of time before committing (M1, M4 session 1, QA session 1).
- M4/M5 passed their gates with a whole requirement (admin product editing) missing; only its
  own code review caught it. The gates checked build and pages, not requirement coverage.
- 696 generated SVG drawings are still written to `public/products/` by the seed (untracked
  runtime files, used as placeholders) although the photos replaced them.

**Harness problems (the lead's, not the coder's)**
- The first version of the gate stopped only `npx` after its page check; next-server and its
  mongod kept running, held `data/mongo`, and the shop on :4000 found no database. Fixed
  (process group), re-run; M2 counted as green.

## The product photos

576 photos, generated on the same RTX 5080 with **Qwen-Image-2.1-Turbo** (Q8_0, 8 steps,
768×768, ~5.9 s each) through Strata's `/v1/images/generations`, one prompt per product,
view and variant colour. They look like studio product photography and match type and colour.
Limits seen: the views of one product are separate images, not the same physical item; with
brand names kept out of the prompts (trademarks), phones of every brand tend to look like
iPhones (with an Apple-like logo) and shoes carry swoosh-like marks. Qwen-Image is licensed for
**non-commercial research use only**; the photos are therefore not in this repository.

## Verdict

The local coder plans and reviews like a senior engineer and, given gates and fresh sessions,
delivers a working, well-structured full-stack shop — storefront with SPA navigation and
faceted search, transactional checkout, an admin with order workflow, packing, UPS labels,
purchasing and a dashboard, 158 tests and three e2e flows — in about five hours of its own
sessions. It is slow with tools newer than its training, tends to run out of time before
committing, and its weakest spot is hard root-cause debugging outside a test loop (see the
SIGPIPE bug below). Its own code review was sharper than the per-milestone gates.

## Earlier tests of the same setup

- Context speed: needle found at 4 k / 32 k / 128 k / 254 k tokens.
- Surgical edits in deeply nested JSON/YAML: 3/3 exact each, and through OpenCode on files
  (716 and 328 leaves) exact.
- Terminal-Bench 2.1, tbench-local's fixed `local-5` suite with OpenCode: 4 of the 4 tasks
  whose agent could start solved (the fifth fails in the harness: Debian 11 mirror moved).
- A hard real bug (`apt-cache … | grep -q` under `pipefail` → SIGPIPE): not solved — the
  agent found a plausible wrong cause and "confirmed" it with a test that could not reproduce
  the real one.
