# CLAUDE.md — Mizan

> This is the ground-truth context file for the project. The decisions here are **final for the hackathon**. Build against them directly; do not swap frameworks, package families, or the base architecture. If something below conflicts with a general habit, this file wins.

## What we are building

**Mizan** — an **agent spending control plane**. It is a "CFO for an AI agent": given a task and a budget, the agent decides *whether a paid tool call is worth it*, remembers which paid providers were cheap/fast/accurate across sessions, verifies each paid result actually served the goal before building on it, and hard-stops runaway spend.

Two cost ledgers run at once and Mizan trades them off:
1. **Reasoning cost** — LLM calls through the **BTL Runtime** (metered in credits).
2. **Tool cost** — paid API calls over **x402** (USDC micro-payments on Base).

The core belief: an autonomous agent that can spend money is only useful if it has **judgment and restraint**. Mizan is the deterministic layer that enforces that.

## The one non-negotiable architecture rule

**The LLM never holds the private key and never signs a payment.** There are three separate layers:

1. **Brain** = BTL Runtime (LLM). Emits *decisions* as tool calls. Never sees the key, never signs.
2. **Hands** = x402 client + wallet (plain TypeScript). Holds the key, signs USDC, pays on HTTP 402.
3. **Conscience** = Mizan guardrails (deterministic code). Sits *between* brain and hands. Decides allow/block/escalate **before** any signature is created.

The LLM proposes; deterministic code disposes. Even if the model is prompt-injected into "pay everything," the conscience layer refuses. **Never put the private key, seed, or wallet secret into any prompt, system message, tool description, or anything that reaches the model's context window.**

## Tech stack (final)

- **Monorepo**: pnpm workspaces + TypeScript everywhere.
- **`apps/agent`**: Node 20 + Express. The agent loop, guardrails, verify step, memory manager, x402 client, and the API/SSE the dashboard reads. This is the heart.
- **`apps/web`**: Next.js (App Router) + Tailwind + Recharts. The live spend dashboard. Web (not React Native) because demo day is a screen-share.
- **`apps/mock-provider`**: Express + `@x402/express`. 3–4 paid endpoints on Base Sepolia so the demo never depends on a flaky third party.
- **DB**: SQLite via Drizzle ORM (driver `better-sqlite3`). Zero-setup, typed, fast.
- **LLM**: BTL Runtime via the `openai` SDK (base URL swap). Model `btl-2` for reasoning, a cheap model for the verify judge.
- **Wallet**: `viem` local account from `EVM_PRIVATE_KEY` env (demo). CDP Server Wallet / ERC-4337 session keys are the roadmap slide, not the 48h build.
- **Payments**: x402 **V2 scoped packages** — `@x402/fetch`, `@x402/express`, `@x402/evm`, `@x402/core`. Do NOT mix with the legacy unscoped `x402-fetch`/`x402-express` unless a V2 package is genuinely missing.
- **Chain**: Base Sepolia (testnet) for the whole build. USDC only.

## Ground-truth constants (verified — do not "correct" these)

- BTL Runtime base URL: `https://api.badtheorylabs.com/v1` — auth `Authorization: Bearer $GATEWAY_API_KEY`.
- BTL reasoning model slug: `btl-2` (smart multi-provider routing). A cheaper model is fine for the verify judge.
- BTL cost headers on every response: `x-btl-request-id`, `x-btl-cache-tier`, `x-btl-benchmark-cost`, `x-btl-customer-charge`, `x-btl-saved`. Spend endpoint: `GET /v1/usage/summary`.
- x402 testnet facilitator: `https://x402.org/facilitator` (no signup). Mainnet later: `https://api.cdp.coinbase.com/platform/v2/x402`.
- CAIP-2 network IDs: Base Sepolia = `eip155:84532`, Base mainnet = `eip155:8453`.
- USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. **USDC has 6 decimals, not 18.** Atomic units: $0.10 = `100000`.
- x402 supports **USDC only** in practice (EIP-3009 gasless transfer). **USDT will not work.**
- Payment settles **only on a 2xx** response. A failed (4xx/5xx) paid request does **not** charge the wallet. Content is served after `verify`, before `settle`.
- Generate a throwaway test wallet:
  `npx tsx -e "import{generatePrivateKey,privateKeyToAccount}from 'viem/accounts';const k=generatePrivateKey();console.log('EVM_PRIVATE_KEY='+k);console.log('ADDRESS='+privateKeyToAccount(k).address)"`
- Fund it: Circle faucet `https://faucet.circle.com` (Base Sepolia USDC) + a Base Sepolia ETH faucet for gas on the *server* wallet (the facilitator pays gas for the *payer*, but the receiving/settlement path still needs a funded facilitator — on x402.org this is handled for you on testnet).
- Discover live real endpoints: `https://x402scan.com`. Known live paid APIs: CoinGecko (`/x402/` path), Firecrawl, Hyperbolic. (Do not rely on aixbt pay-per-use — deprecating 2026-07-15.)

## The five guardrails (deterministic, enforced in `apps/agent/src/guardrails`)

Every proposed paid call passes through ALL of these before the wallet is allowed to sign:
1. **Hard budget cap** — total **tool (x402)** spend this run must stay ≤ the user's budget. Reject if this call would exceed it. Checked *before* the per-call rule and **never bypassed — not even by a human-approved escalation** (an approved over-per-call call still fails if it would exceed the total budget). Reasoning (BTL) cost is a separate ledger, not counted against this cap.
2. **Per-call ceiling / escalation** — if a single call exceeds the user's per-call limit, pause and ask the human to approve (do not auto-pay). On approval the call carries an `approved` flag that skips *only* the per-call rule; the hard budget cap (#1) still applies.
3. **Duplicate-call detection** — hash `(endpoint + normalized args)`. If already paid this run, return the cached result, do not pay again.
4. **No-progress streak** — if N consecutive paid calls fail the verify step (added no usable signal), stop and report.
5. **Iteration backstop** — absolute max number of loop turns / paid calls per run, regardless of budget.

Guardrails are pure functions returning `{ allow: boolean, reason: string, action: "pay" | "block" | "escalate" | "use_cache" }`. They must be unit-testable without any network.

## The verify step (why Mizan is different)

After every paid call, a **separate cheap LLM judge** (via BTL) answers: *"Did this response actually satisfy this sub-goal? yes/no + one-line reason."* If **no**, the result is flagged and **not built upon**, and the provider's `accuracy` score drops. This is what stops the agent from paying for and then trusting garbage.

## Provider memory (the RetainDB-style learning)

A `providers` table stores first-hand outcomes: `{ endpoint, capability, avg_cost, avg_latency_ms, accuracy_score, times_used, last_used }`. Before choosing who to pay, the agent ranks known providers for the needed capability by a score blending cost, latency, and accuracy. Updated after every paid call + verify. This is what makes the **warm run** cheaper than the **cold run** — the demo's money shot.

## Commands

```bash
pnpm install
pnpm --filter mock-provider dev     # paid endpoints on :4021 (Base Sepolia)
pnpm --filter agent dev             # agent API + SSE on :3001
pnpm --filter web dev               # dashboard on :3000
pnpm --filter agent test            # guardrail unit tests
pnpm db:push                        # drizzle-kit push (REQUIRES drizzle.config.ts at repo root — see docs/05)
pnpm db:seed                        # seed providers (good + bad, same capability) for the warm-run demo
```

## Conventions

- TypeScript strict. No `any` in guardrails or the payment path.
- All money is handled as integer **atomic USDC units (6 decimals)** internally; format to dollars only at the UI edge. Never do float math on balances.
- Every paid attempt (allowed, blocked, or escalated) writes one row to the `decisions` ledger with the full trace: sub-goal, provider, estimated cost, guardrail outcome, verify verdict, tx hash (if paid). The ledger is the audit trail and the demo data source.
- The agent streams each decision to the dashboard over SSE as it happens — the UI shows reasoning → guardrail check → payment → verify live.
- Secrets only in `.env` (gitignored): `GATEWAY_API_KEY`, `EVM_PRIVATE_KEY`, `SERVER_PAY_TO_ADDRESS`. `.env.example` committed with empty values.

## Halal constraints (product requirement, not optional)

Spot-only USDC micro-payments for services rendered. **No** interest/lending/yield, **no** leverage, **no** perpetuals, **no** betting/prediction-market/gambling mechanics, **no** custody of anyone else's funds. The wallet is the user's own, non-custodial. Keep every feature inside this line.

## What NOT to do

- Do not let the model sign, hold, or see the key. Guardrails are code, not prompt instructions.
- Do not use USDT or assume multi-token support.
- Do not use 18 decimals for USDC.
- Do not build the on-chain spend-cap contract, a full reputation network, or RN mobile app in the 48h — those are roadmap slides.
- Do not mix legacy `x402-*` and scoped `@x402/*` packages in the same client.
- Do not block the whole UI on a slow call; stream progressively.

## Resolved build decisions (2026-07-04 pre-build audit — final)

A 5-agent verification+critique pass ran against all 9 spec docs. External plumbing is de-risked (x402 V2 `@x402/*@2.17.0` import paths, OpenAI SDK, Drizzle/viem all confirmed correct). These ambiguities/contradictions were resolved in the layer docs — build against them:

- **Loop model = Hybrid.** `plan()` tags each sub-goal with a `capability` (or `null`). Per sub-goal, call BTL with **capability-named tools** (`get_holders`/`get_liquidity`/`audit_contract`/`answer`); the model chooses `answer` (free) or a paid tool; the loop maps `tool.name → capability → provider → guardrails → pay`. One loop model, not two. (docs/03)
- **`estCostAtomic` comes from a shared price catalog** (`packages/shared/src/catalog.ts`), imported by both `discover()` and the mock-provider. Never defaults to 0. New/seeded providers init `avgCost = priceAtomic`, `avgLatency = 1500` (a 0 would make unknowns rank as "free" and invert the ranking). (docs/03, 05)
- **Budget = tool (x402) spend only.** Reasoning cost is the second ledger, shown but not capped. The SpendMeter bar is tool-vs-budget. (docs/03, 04)
- **Escalation** = in-memory `Map<decisionId, resolve>` with a 60s auto-deny timeout; mint+stream the `pending` decision *before* awaiting; on approve, re-run `evaluate()` with `approved:true` (budget still enforced); emit `decision:update` to transition the row. (docs/03)
- **x402 V2 has no built-in ~0.1 USDC client cap** (that was legacy). Guardrails are the cap. (docs/07)
- **`savedByMemory`** = post-hoc deterministic baseline (sum of the most-expensive catalog provider per sub-goal capability) − actual tool spend. Cold run is genuinely empty-memory; seed is the recording fallback. (docs/05)
- Canonical field name is **`savedAtomic`** (not `savedByCacheAtomic`); `provider`/`capability` are nullable; `pay()` returns `costAtomic`; every BTL call is wrapped with `.withResponse()` and cost rounded to integer micros; `role:"tool"` replies need `tool_call_id`; `drizzle.config.ts` is required. (docs/03, 05, 06, 07)

## Read next

`docs/01-PROBLEM-AND-SOLUTION.md` → `docs/02-ARCHITECTURE.md` → then the layer doc for whatever you're building (`03-BACKEND`, `04-FRONTEND`, `05-DATA-MODEL`, `06-BTL-RUNTIME`, `07-X402-PAYMENTS`). **`docs/Phases.md` is the authoritative, check-gated execution plan (hard deadline Jul 5, 15:00 UTC) — follow it phase-by-phase; do not start a phase until the previous phase's checks pass.** `08-BUILD-PLAN.md` is the detailed hour-by-hour reference behind it. `09-DEMO-SCRIPT.md` is what we present.
