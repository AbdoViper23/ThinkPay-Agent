<div align="center">

# ThinkPay

### A CFO for your AI agent — an autonomous agent that knows when *not* to pay.

**Reasoning on the BTL Runtime · Paid tools over x402 · Deterministic spend guardrails · Cross-session provider memory · Per-call goal verification**

<br/>

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-App_Router-000000?logo=next.js&logoColor=white)
![BTL Runtime](https://img.shields.io/badge/reasoning-BTL_Runtime-B08D3F)
![x402](https://img.shields.io/badge/payments-x402_·_USDC-2775CA)
![Base](https://img.shields.io/badge/chain-Base_Sepolia-0052FF?logo=coinbase&logoColor=white)

<br/>

> **Most teams demo an agent that pays for tools.**
> **ThinkPay demos an agent that decides *not* to pay — remembers why, verifies what it bought, and proves every decision on-chain.**
> A spending **control plane**, not a payment demo.

</div>

---

## Table of Contents

- [1. The problem](#1-the-problem)
- [2. How ThinkPay solves it](#2-how-thinkpay-solves-it)
- [3. Built on the BTL Runtime ⭐](#3-built-on-the-btl-runtime-)
- [4. Architecture — Brain / Conscience / Hands](#4-architecture--brain--conscience--hands)
- [5. The five guardrails](#5-the-five-guardrails)
- [6. The verify step](#6-the-verify-step)
- [7. Provider memory — the cold → warm money shot](#7-provider-memory--the-cold--warm-money-shot)
- [8. The demo](#8-the-demo)
- [9. Running it yourself](#9-running-it-yourself)
- [10. Tech stack](#10-tech-stack)
- [11. Repo map](#11-repo-map)
- [12. Data model](#12-data-model)
- [13. Security posture](#13-security-posture)
- [14. Roadmap](#14-roadmap)
- [15. Documentation](#15-documentation)

---

## 1. The problem

AI agents can now call tools — and increasingly they can **pay** for those tools autonomously. The mechanism is [x402](https://x402.org): the agent hits an API, gets **HTTP 402 Payment Required**, signs a USDC micro-payment, and retries. The moment an agent controls a wallet, a whole new class of failure appears that ordinary agent tooling does **not** handle:

| # | Failure | What actually happens |
|---|---|---|
| 1 | **No spend judgment** | The agent pays for whatever it thinks it needs — blind to whether the call is worth the money, or whether a free path exists. |
| 2 | **Pays for garbage** | A paid API returns off-topic or low-quality data. A naive agent pays, then **builds its entire reasoning on the junk.** |
| 3 | **Runaway loops** | It repeats calls, retries endlessly, and burns the whole budget with **no progress**. |
| 4 | **No memory** | Every run starts blind. It re-discovers, re-pays, and re-learns which providers are bad — **every single time.** |
| 5 | **No accountability** | There is no trace a human or finance team can audit: **what** was bought, **why**, whether it was **approved**, and what it **cost**. |

This is a real, named emerging need — a **control plane for agent spending** ("Spend OS" / FinOps for agents). And the market has split down the middle:

- Some products do **budget caps and human approval.**
- Others do **provider discovery and quality scores.**

> **No shipping product combines spend guardrails + agent-owned cross-session provider learning + per-call goal-verification.**
> That gap is the opportunity. **ThinkPay fills all three.**

---

## 2. How ThinkPay solves it

ThinkPay is the **deterministic control plane** that sits between an agent's reasoning and its wallet. Point it at a task and a budget:

> *"Analyze token X. Budget **$0.25**. Ask me before any single call over **$0.05**."*

It researches **holder distribution**, **liquidity depth**, and **contract safety** by buying live data over x402 — but before it ever signs a payment, it does the six things a good CFO does. Each one **directly answers** a failure from §1:

| Solves | ThinkPay does this | How |
|:---:|---|---|
| ① | **Decides whether to spend at all** | For each sub-goal, the agent first asks *"can this be answered for free?"* — it only pays when paying adds signal. |
| ② | **Verifies every paid result** | A separate cheap LLM judge asks *"did this actually serve the goal?"* — if not, the result is **dropped, not built upon**, and the provider is penalized. |
| ③ | **Enforces hard guardrails before any signature** | Budget cap · per-call ceiling with human escalation · duplicate detection · no-progress streak · iteration backstop. |
| ④ | **Learns which providers are worth paying** | Ranks known providers by a blend of **cost, latency, and past accuracy** — persisted **across runs**. |
| ⑤ | **Records everything** | Every decision — *paid, blocked, or escalated* — is written to an auditable ledger with the on-chain **tx hash**. |
| ⑥ | **Puts both cost ledgers on one screen** | Reasoning cost (BTL Runtime) and tool cost (x402) side-by-side, so you watch the agent trade *thinking* vs *buying*. |

**The differentiator in one sentence:**

> Most teams will demo an agent that **pays** for tools. ThinkPay demos an agent that **decides not to pay, remembers why, verifies what it bought, and proves every decision.**

---

## 3. Built on the BTL Runtime ⭐

**The BTL Runtime is the brain of ThinkPay — and it is load-bearing, not decorative.** The runtime's whole thesis is **memory + judgment + restraint** (*"systems should show up only when the signal is high enough; taste is a moat"*). ThinkPay is the literal embodiment of that thesis, **applied to money.**

### Four distinct LLM roles, all on the runtime

The runtime doesn't do one thing here — it plays **four separate roles**, each a different call with a different prompt:

| Role | What it does | Model |
|---|---|---|
| **`plan()`** | Decomposes the task into sub-goals, each tagged with a `capability` (`holders` / `liquidity` / `audit`) or `null` (free). | `btl-2` |
| **Agent loop** | Per sub-goal, called with **capability-named tools** — chooses `answer` (free) or a paid tool. Its best move is often *not to spend.* | `btl-2` |
| **Verify judge** | After every paid call: *"did this response satisfy the sub-goal? yes/no + reason."* | cheap model |
| **`compose()`** | Writes the final research report from verified results only. | `btl-2` |

### The runtime's own cost is a first-class citizen

Every BTL call is wrapped with `.withResponse()` so we read the runtime's **metered cost headers** on every response:

```
x-btl-request-id · x-btl-cache-tier · x-btl-benchmark-cost · x-btl-customer-charge · x-btl-saved
```

We round `x-btl-customer-charge` to integer **micro-dollars** and put it on the **same dashboard** as the on-chain x402 tool spend. **That's the point of the whole demo:** you literally watch the agent trade *"spend more credits on reasoning"* against *"buy the answer over x402."* Two ledgers, one screen.

### Why this is the *best* use of the runtime

- **Reasoning, tool-calling, streaming, and multi-provider routing** through `btl-2` are all load-bearing — remove the runtime and there is no agent.
- **Memory** — cross-session provider learning is the RetainDB thesis in miniature, and it's the mechanism behind the warm-run savings.
- **Judgment & restraint** — the guardrails and the verify judge *are* selective attention applied to spending. The agent that refuses to pay is the runtime's thesis made concrete.

> Config: base URL `https://api.badtheorylabs.com/v1`, auth `Authorization: Bearer $GATEWAY_API_KEY`, reasoning model `btl-2`. Full integration in [`docs/06-BTL-RUNTIME.md`](docs/06-BTL-RUNTIME.md).

---

## 4. Architecture — Brain / Conscience / Hands

**The one non-negotiable rule: the LLM never holds the private key and never signs a payment.** Three strictly separated layers:

- **Brain** — the LLM (BTL Runtime). Emits *decisions* as tool calls. Never sees the key.
- **Conscience** — deterministic guardrail code. Decides allow / block / escalate **before** any signature exists.
- **Hands** — the x402 client + `viem` wallet. Holds the key, signs USDC — **only when the conscience allows it.**

```
 User: "Analyze token X.  Budget $0.25.  Ask me before any call over $0.05."
        │
        ▼
 ┌───────────────┐  proposes paid calls   ┌────────────────────┐  allow / block /   ┌───────────────┐
 │  BRAIN         │ ─────────────────────▶ │  CONSCIENCE         │  escalate          │  HANDS         │
 │  BTL Runtime   │                        │  ThinkPay guardrails│ ─────────────────▶ │  x402 wallet   │
 │  (LLM · btl-2) │ ◀───────────────────── │  (deterministic)    │  pays USDC only    │  (viem, local) │
 └───────────────┘  verified results only  └────────────────────┘  when allowed      └───────────────┘
        ▲                                            │                                        │
        │                                            ▼                                        ▼
        │                                   ┌────────────────────┐                   HTTP 402 → sign
        └───────── verify verdict ◀──────── │  VERIFY JUDGE       │                   EIP-3009 USDC
                   (cheap LLM)               │  "did this serve    │                   Base Sepolia
                                             │   the sub-goal?"    │
                                             └────────────────────┘
                                                      │
                                                      ▼
                                          ┌───────────────────────┐   live SSE stream   ┌──────────────┐
                                          │  DECISION LEDGER       │ ──────────────────▶ │  DASHBOARD    │
                                          │  (SQLite · audit)      │                     │  (Next.js)    │
                                          └───────────────────────┘                     └──────────────┘
```

> The LLM proposes; deterministic code disposes. Even if the model is prompt-injected into *"pay everything,"* the conscience refuses — because **guardrails are code, not prompt instructions.** The key lives only inside the payment module and never enters the model's context window.

---

## 5. The five guardrails

Every proposed paid call passes through **all five** before the wallet is allowed to sign. They are **pure functions** returning `{ allow, reason, action }` — fully unit-testable with **zero network**.

| # | Guardrail | Rule | Action |
|---|---|---|---|
| 1 | **Hard budget cap** | Total x402 spend this run must stay ≤ budget. **Never bypassed — not even by a human-approved escalation.** | `block` |
| 2 | **Per-call ceiling / escalation** | A single call over the per-call limit **pauses and asks a human**. Approval skips *only* this rule — cap #1 still applies. | `escalate` |
| 3 | **Duplicate-call detection** | Hash `(endpoint + normalized args)`. Already paid this run? Return the cached result — **don't pay twice.** | `use_cache` |
| 4 | **No-progress streak** | N consecutive paid calls that fail verify (no usable signal) → **stop and report.** | `block` |
| 5 | **Iteration backstop** | Absolute max loop turns / paid calls per run, regardless of budget. | `block` |

> Reasoning cost (BTL) is a **separate ledger** — shown, but never counted against the tool-spend cap.

---

## 6. The verify step

After **every** paid call, a separate **cheap LLM judge** on the runtime answers one question:

> *"Did this response actually satisfy this sub-goal? **yes/no + one-line reason.**"*

- **`no`** → the result is **flagged and not built upon**, and the provider's `accuracy_score` **drops** (an exponential moving average of past verdicts).
- **`yes`** → the result feeds the agent's reasoning, and the provider's score **rises**.

This is the mechanism that stops the agent from **paying for garbage and then trusting it** — and it's what makes the provider memory *earned* rather than declared.

> **x402 timing we exploit:** payment settles **only on a 2xx**, and content is served **after verify, before settle** — so a failed paid request never charges the wallet.

---

## 7. Provider memory — the cold → warm money shot

A `providers` table stores **first-hand outcomes** across runs:

```
{ endpoint, capability, avg_cost, avg_latency_ms, accuracy_score, times_used, last_used }
```

Before choosing who to pay, the agent **ranks known providers** for the needed capability by a blend of **cost, latency, and accuracy** — *cheapest-that-works*, not just cheapest. This is what makes the **warm run cheaper than the cold run** — the demo's money shot:

```
   COLD RUN  (empty memory)                         WARM RUN  (learned memory)
 ─────────────────────────────                     ─────────────────────────────
 • pays Provider A for holders        ✓             • skips Provider B entirely (demoted)
 • pays Provider B for liquidity      ✗ verify      • goes straight to best-scored providers
   → dropped, not built on, B demoted               • fewer calls, no wasted spend
 • pays Provider C for liquidity      ✓             • "Saved by memory" counts up
 • duplicate call blocked  → $ saved
 • audit $0.06 > per-call limit → escalate → ✓

 TOTAL ≈ $0.098                                     TOTAL ≈ $0.05
```

> **`savedByMemory`** is a deterministic, post-hoc baseline: *(sum of the most-expensive catalog provider per sub-goal capability)* − *actual tool spend*. An honest number, not a vibe.

---

## 8. The demo

**5-minute live demo · 3-min Q&A · 2-min submission video.** Lead with the money shot; explain the thesis second.

1. **The hook** — *"An AI agent that researches a crypto token: who holds it, how deep its liquidity is, whether the contract is safe. To answer, it buys live data over x402 — real USDC, on-chain. Most agents that can pay will pay for the wrong things, pay twice, and pay for garbage. ThinkPay knows when **not** to."*
2. **Cold run** — enter task + `$0.25` budget + `$0.05` per-call limit. Narrate the ledger as it streams: pay A ✓ → pay B → **verify flags it, dropped** → pay C ✓ → **duplicate blocked, saved** → audit over limit → **escalate → Approve**. Finishes ≈ `$0.098`.
3. **Warm run** — *"Now it remembers."* Skips the bad provider, goes straight to the best-scored ones, fewer calls, ≈ `$0.05`. The **"Saved by memory"** figure counts up.
4. **The close** — *"Reasoning on the BTL Runtime, payments over x402, memory and judgment in between. Not a payment demo — a control plane."*

A bundled **mock-provider** (real x402 endpoints on Base Sepolia) means the demo **never depends on a flaky third party.** Full script + judging talking points in [`docs/09-DEMO-SCRIPT.md`](docs/09-DEMO-SCRIPT.md).

---

## 9. Running it yourself

### Prerequisites

- **Node.js ≥ 20** and **pnpm 11** (`npm i -g pnpm`)
- A **BTL Runtime API key** (`GATEWAY_API_KEY`) — this powers all reasoning + the verify judge
- A **Base Sepolia wallet** with a little test **USDC** and **ETH** (both free from faucets — see below)

### Step 1 — Install

```bash
git clone <this-repo> thinkpay && cd thinkpay
pnpm install
```

### Step 2 — Configure secrets

```bash
cp .env.example .env
```

Then fill in `.env` (it is gitignored — never commit it):

| Variable | What it is | How to get it |
|---|---|---|
| `GATEWAY_API_KEY` | BTL Runtime auth (inference scope) — reasoning + verify judge | From your BTL Runtime / hackathon dashboard |
| `EVM_PRIVATE_KEY` | The agent's own wallet key (`0x…`) — the **only** secret the payment module reads, never enters a prompt | Generate a throwaway one ↓ |
| `SERVER_PAY_TO_ADDRESS` | Address that receives test USDC on the mock-provider | Any address you control (your own wallet is fine) |
| `X402_FACILITATOR_URL` | x402 testnet facilitator (no signup) | Already filled — leave as-is (`https://x402.org/facilitator`) |

**Generate a throwaway test wallet:**

```bash
npx tsx -e "import{generatePrivateKey,privateKeyToAccount}from 'viem/accounts';const k=generatePrivateKey();console.log('EVM_PRIVATE_KEY='+k);console.log('ADDRESS='+privateKeyToAccount(k).address)"
```

**Fund it (both free, testnet):**
- Base Sepolia **USDC** → [Circle faucet](https://faucet.circle.com)
- Base Sepolia **ETH** (for gas) → any Base Sepolia ETH faucet

> USDC on Base Sepolia is `0x036CbD53842c5426634e7929541eC2318f3dCF7e` and has **6 decimals** (`$0.10 = 100000` atomic units).

### Step 3 — Rebuild the database and stage the demo state

```bash
pnpm db:push          # recreate the SQLite tables from scratch (empty schema)
pnpm db:seed:cold     # seed providers for the cold→warm scenario
                      #   (stages the BAD provider to look cheap/attractive at first)
```

### Step 4 — Start the three processes (each in its own terminal)

```bash
pnpm mock      # mock server running the paid x402 services (fake providers)   → :4021
pnpm agent     # the backend / agent brain + the SSE stream the dashboard reads → :3001
pnpm web       # the dashboard (Next.js) you present during the demo            → :3000
```

| Command | Port | Role |
|---|---|---|
| `pnpm mock` | `4021` | Paid x402 endpoints on Base Sepolia — the demo's safety net so nothing depends on a flaky third party |
| `pnpm agent` | `3001` | The heart: the loop, guardrails, verify, memory, x402 client, and the SSE the dashboard reads |
| `pnpm web` | `3000` | The Next.js dashboard — open this in your browser |

### Step 5 — Open the demo

1. Browser → **http://localhost:3000**
2. Click **Launch app**
3. Switch the toggle to **Live**
4. **Run** → this is the **cold** run (empty memory, learns the providers) ≈ `$0.098`
5. **Run again** → this is the **warm** run (skips the bad provider) ≈ `$0.05`

Watch the ledger stream live — **reasoning → guardrail check → payment → verify**, decision by decision. The **"Saved by memory"** figure counting up on the warm run is the money shot.

> To reset back to the cold state between demos, just re-run `pnpm db:seed:cold`.

### Verify it works (smoke tests)

```bash
pnpm --filter agent test    # guardrail unit tests — no network needed
pnpm smoke:btl              # confirm the BTL Runtime key + reasoning work
pnpm smoke:x402             # confirm an end-to-end x402 payment settles
```

> Every constant, faucet link, and gotcha is documented in [`CLAUDE.md`](CLAUDE.md) — the project's ground-truth context file.

---

## 10. Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Reasoning** | **BTL Runtime** via the `openai` SDK (base-URL swap), model `btl-2` | Smart multi-provider routing + metered cost headers — the brain |
| **Monorepo** | pnpm workspaces + TypeScript (strict) | One typed graph; no `any` in guardrails or the payment path |
| **`apps/agent`** | Node 20 + Express | The heart: loop, guardrails, verify, memory, x402 client, API + SSE |
| **`apps/web`** | Next.js (App Router) + Tailwind + Recharts | Live spend dashboard — web, because demo day is a screen-share |
| **`apps/mock-provider`** | Express + `@x402/express` | Paid endpoints on Base Sepolia — the demo's safety net |
| **Database** | SQLite via Drizzle ORM (`better-sqlite3`) | Zero-setup, typed, fast |
| **Wallet** | `viem` local account from `EVM_PRIVATE_KEY` | Non-custodial — the user's own key |
| **Payments** | x402 **V2 scoped packages** — `@x402/fetch`, `@x402/express`, `@x402/evm`, `@x402/core` | Gasless EIP-3009 USDC transfers |
| **Chain** | Base Sepolia (testnet), USDC only | Safe for a demo; USDC has **6 decimals** |

---

## 11. Repo map

```
thinkpay/
├─ CLAUDE.md                # ground-truth context — read first
├─ apps/
│  ├─ agent/                # the heart: loop, guardrails, verify, memory, x402 client, API + SSE
│  │  ├─ src/loop.ts        #   the hybrid agent loop
│  │  ├─ src/btl.ts         #   BTL Runtime integration — plan / loop / verify / compose
│  │  ├─ src/guardrails/    #   pure, network-free, unit-tested decision functions
│  │  ├─ src/pay/x402.ts    #   the ONLY place the key is touched
│  │  └─ src/ledger.ts      #   decision ledger writes
│  ├─ web/                  # Next.js live spend dashboard (SSE-driven)
│  └─ mock-provider/        # x402-paid endpoints on Base Sepolia (demo safety net)
├─ packages/
│  └─ shared/               # types, atomic-USDC helpers, price catalog, Drizzle schema + seeds
└─ docs/                    # full spec — problem, architecture, per-layer, build plan, demo
```

---

## 12. Data model

Three SQLite tables — all money as integer atomic USDC units. See [`docs/05-DATA-MODEL.md`](docs/05-DATA-MODEL.md).

- **`providers`** — persists **across runs**. First-hand cost / latency / accuracy per endpoint — the learning that makes the warm run cheaper. New providers init `avgCost = catalog price` and `avgLatency = 1500` (never `0`, so unknowns don't rank as "free" and invert the ranking).
- **`runs`** — one row per agent run: task, budget, per-call limit, tool spend, reasoning cost, `savedByMemory`, status.
- **`decisions`** — the **audit ledger**. One row per decision — *paid, blocked, or escalated* — with sub-goal, provider, estimated & paid cost, guardrail outcome, verify verdict, and on-chain `tx_hash`. Both the audit trail and the demo's live data source.

Prices come from a **single shared catalog** (`packages/shared/src/catalog.ts`), imported by both the agent's `discover()` and the mock-provider — so the price the guard estimates and the price the seller charges **can never drift.**

---

## 13. Security posture

- **The model never holds, sees, or signs with the key.** It only proposes tool calls. The key lives exclusively in the payment module and never enters any prompt, system message, or tool description.
- **Guardrails are code, not prompt rules.** A prompt-injected or hijacked agent still cannot exceed the budget, pay twice, or bypass the per-call ceiling — the deterministic layer refuses.
- **Failed paid requests don't charge the wallet.** x402 settles only on `2xx`; content is served *after verify, before settle*.
- **Roadmap hardening:** enforce the spend cap **on-chain** with an ERC-4337 session key, so even a compromised backend cannot exceed it.

---

## 14. Roadmap

Explicitly **out of scope for the 48h build** — the "what's next" slides:

- **On-chain spend cap** via ERC-4337 session keys (enforce the budget in the contract, not just the backend).
- **Networked provider reputation** — write verify verdicts to ERC-8004 with proof-of-payment, so learning is shared across agents.
- **Mainnet settlement** and a hosted control plane in front of real spending agents.
- **CDP Server Wallet** integration to replace the demo `viem` local account.

---

## 15. Documentation

| File | What |
|---|---|
| [`docs/01-PROBLEM-AND-SOLUTION.md`](docs/01-PROBLEM-AND-SOLUTION.md) | Problem, solution, why it wins, competitive gap |
| [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) | Three-layer architecture, data flow, sequence diagram, monorepo |
| [`docs/03-BACKEND.md`](docs/03-BACKEND.md) | Agent loop, tool schemas, guardrails, verify, memory, API / SSE |
| [`docs/04-FRONTEND.md`](docs/04-FRONTEND.md) | Dashboard spec, design direction, the demo view |
| [`docs/05-DATA-MODEL.md`](docs/05-DATA-MODEL.md) | SQLite / Drizzle schema: providers, runs, decision ledger |
| [`docs/06-BTL-RUNTIME.md`](docs/06-BTL-RUNTIME.md) | Exact BTL integration, models, cost headers, gotchas |
| [`docs/07-X402-PAYMENTS.md`](docs/07-X402-PAYMENTS.md) | Exact x402 client / server code, wallet, facilitator, gotchas |
| [`docs/Phases.md`](docs/Phases.md) | **Authoritative check-gated execution plan** — start here for build order |
| [`docs/08-BUILD-PLAN.md`](docs/08-BUILD-PLAN.md) | Detailed hour-by-hour reference behind `Phases.md` |
| [`docs/09-DEMO-SCRIPT.md`](docs/09-DEMO-SCRIPT.md) | Demo-day script + judging talking points |

---

<div align="center">

### An agent that spends money is only useful if it has the judgment not to.

**ThinkPay is that judgment — on the BTL Runtime, over x402.**

<br/>

*Built for the BTL Runtime Hackathon · TypeScript · x402 · Base Sepolia · Non-custodial*

</div>
