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

| Phase | Start | End | Minutes |
|---|---|---|---:|
| 1 Architecture + plan | 01:18:52 | 01:23:02 | 4.2 |
| 2 Review | 01:23:23 | 01:28:53 | 5.5 |
| 3 Revision (time box hit) + 3b finish, README, first push | 01:29:15 | 01:41:02 | 11.8 |
| M1 scaffold, data, seed (time box hit) | 01:41:25 | 01:52:25 | 11.0 |
| M1b gate fixes (with lead hints) + seed (time box hit) | 01:53:06 | 02:03:06 | 10.0 |
| M1c gate fixes (symptoms only) — M1 green, committed, pushed | 02:03:33 | 02:10:03 | 6.5 |

## What the coder did on its own, and where it was helped

**On its own**
- Verified every package version before planning (Next.js 16.4, React 19.3, Tailwind 4.3,
  TypeScript 7.0, Mongoose 9.11, mongodb-memory-server 11.3, Vitest 5, ESLint 10, Zod 4.6).
- A 333-line architecture and a 135-line plan whose acceptance criteria are commands
  (`curl … | grep`, DB checks, PDF magic bytes, tracking-number regex).
- A review that found four blockers (Server Actions cannot be checked with curl; admin CSRF and
  session gaps; shipping labels with customer addresses under `public/`; an unsafe mongod
  lifecycle) and ten majors.
- In M1: the Next.js scaffold, shadcn/ui on a CLI newer than it knew (it read `--help` and
  found the right preset itself), approved only the three install scripts that were needed,
  six Mongoose models, pure domain logic with 73 of 76 tests green, the 200-product seed with
  576 generated SVG images; it noticed a crash in its own seed output (scrypt memory limit),
  fixed it and wrote its own verification script.

**Helped by the lead** (gate M1 → M1b, before the rule above)
- That `typescript-eslint` does not support TypeScript 7 and a downgrade is the fix.
- That Next.js 16 `cacheComponents` rejects the route segment config in the health route.
- That a VAT test expected the wrong value while the code was right.

- In M1c, from raw build/test output only: 25 TypeScript errors (shadcn's `cn` import, Node 24
  crypto typings, Vitest 5 config), the two failing transaction tests; it then measured exit
  codes properly (`BUILD=$?` instead of piping into `tail`), checked `/api/health` on a
  background server, removed its own helper scripts, committed and pushed. Gate: 76/76 tests,
  lint and build green.

**Missed** (counted against the coder)
- The plan said "prove the toolchain first"; M1 did not, so the TypeScript 7 problem surfaced
  only at the gate.
- The first seed run's failure was hidden by `| tail` (exit code 0).
- docs/DECISIONS.md gives "7.0.2 is not resolvable" as the reason for TypeScript 6 — the real
  reason (typescript-eslint has no TS 7 support) came from the lead.
- Within the hour only M1 was finished; M2–M5 (storefront, checkout, admin) were not started.

## Earlier tests of the same setup

- Context speed: needle found at 4 k / 32 k / 128 k / 254 k tokens.
- Surgical edits in deeply nested JSON/YAML: 3/3 exact each, and through OpenCode on files
  (716 and 328 leaves) exact.
- Terminal-Bench 2.1, tbench-local's fixed `local-5` suite with OpenCode: 4 of the 4 tasks
  whose agent could start solved (the fifth fails in the harness: Debian 11 mirror moved).
- A hard real bug (`apt-cache … | grep -q` under `pipefail` → SIGPIPE): not solved — the
  agent found a plausible wrong cause and "confirmed" it with a test that could not reproduce
  the real one.
