# ThinkPay — an AI research agent that knows when not to pay

**A CFO for your agent.** Point it at a crypto token and a budget: it researches holder distribution, liquidity depth, and contract safety by buying live data over x402 — deciding whether each paid call is worth it, remembering which providers are cheap/fast/accurate, verifying it got what it paid for, and refusing to overspend. Underneath, it's a spending **control plane** any spending agent can reuse.

Built for the **BTL Runtime Hackathon**. Reasoning runs on the **BTL Runtime**; paid tools are called over **x402** (USDC on Base). The point isn't "an AI that pays" — it's **an AI that decides *not* to pay**, and proves it.

## Why it matters

Autonomous agents that can spend money need a control plane: something that decides when spending is allowed, blocks wasteful or duplicate purchases, escalates big spends for approval, and records every decision. Today's tools do budget caps *or* provider discovery — none combine spend guardrails with **agent-owned, cross-session learning** of which providers are actually worth paying, plus **per-call goal-verification**. ThinkPay does.

## The three layers (core idea)

```
 User: "Analyze token X. Budget $0.25, ask me before any call over $0.05."
        │
        ▼
 ┌──────────────┐   proposes paid calls    ┌───────────────────┐   allow/block/    ┌──────────────┐
 │  BRAIN        │ ───────────────────────▶ │  CONSCIENCE        │   escalate        │  HANDS        │
 │  BTL Runtime  │                          │  ThinkPay guardrails  │ ────────────────▶ │  x402 wallet  │
 │  (LLM)        │ ◀─────────────────────── │  (deterministic)   │   pays USDC only  │  (viem)       │
 └──────────────┘   verified results only   └───────────────────┘   when allowed    └──────────────┘
```

The LLM decides; deterministic code controls the money; the wallet signs. **The model never holds the key.**

## Quickstart

```bash
pnpm install
cp .env.example .env        # fill GATEWAY_API_KEY, EVM_PRIVATE_KEY, SERVER_PAY_TO_ADDRESS
pnpm db:push && pnpm db:seed
pnpm --filter mock-provider dev   # :4021
pnpm --filter agent dev           # :3001
pnpm --filter web dev             # :3000  → open the dashboard
```

Generate a throwaway wallet and fund it with Base Sepolia test USDC (Circle faucet). See `CLAUDE.md` for exact commands and constants.

## Repo map

```
thinkpay/
├─ CLAUDE.md              # ground truth for the coding agent — read first
├─ apps/
│  ├─ agent/              # the loop, guardrails, verify, memory, x402 client, API+SSE
│  ├─ web/                # Next.js live spend dashboard
│  └─ mock-provider/      # x402-paid endpoints on Base Sepolia (demo safety net)
├─ packages/
│  └─ shared/             # types, atomic-USDC helpers, db schema
└─ docs/                  # full spec — problem, architecture, per-layer, build plan, demo
```

## Docs

| File | What |
|---|---|
| `docs/01-PROBLEM-AND-SOLUTION.md` | Problem, solution, why it wins, competitive gap, halal framing |
| `docs/02-ARCHITECTURE.md` | Three-layer architecture, data flow, sequence diagram, monorepo |
| `docs/03-BACKEND.md` | Agent loop, tool schemas, guardrails, verify, memory, API/SSE |
| `docs/04-FRONTEND.md` | Dashboard spec, design direction, the demo view |
| `docs/05-DATA-MODEL.md` | SQLite/Drizzle schema: providers, runs, decisions ledger |
| `docs/06-BTL-RUNTIME.md` | Exact BTL integration, models, cost headers, gotchas |
| `docs/07-X402-PAYMENTS.md` | Exact x402 client/server code, wallet, facilitator, testnet, gotchas |
| `docs/Phases.md` | **Authoritative check-gated execution plan (hard deadline Jul 5, 15:00 UTC) — start here for build order** |
| `docs/08-BUILD-PLAN.md` | Detailed hour-by-hour reference behind `Phases.md` (milestones, fallback ladder) |
| `docs/09-DEMO-SCRIPT.md` | Demo-day script + judging talking points |
