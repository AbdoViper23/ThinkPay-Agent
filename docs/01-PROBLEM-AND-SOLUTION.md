# 01 — Problem & Solution

## The problem

AI agents can now call tools, and increasingly they can **pay** for those tools autonomously (via x402: HTTP 402 → sign a USDC micro-payment → retry). The moment an agent controls a wallet, a new class of problem appears that normal agent tooling doesn't handle:

- **No spend judgment.** The agent pays for whatever it thinks it needs, with no sense of whether a call is worth the money, or whether a free path exists.
- **Pays for garbage.** A paid API can return off-topic or low-quality data; a naive agent pays, then *builds its reasoning on the junk*.
- **Runaway loops.** Agents repeat calls, retry endlessly, and burn budget with no progress.
- **No memory.** Every run starts blind. The agent re-discovers, re-pays, and re-learns which providers are bad — every single time.
- **No accountability.** There's no trace a human or finance team can audit: what was bought, why, whether it was approved, and what it cost.

This is a real, named emerging need: a **control plane for agent spending** ("Spend OS" / FinOps for agents). The market has split — some products do budget caps and human approval; others do provider discovery and quality scores. **None combine spend guardrails with agent-owned, cross-session provider learning and per-call goal-verification.** That gap is the opportunity.

## The solution — Mizan

Mizan is the **deterministic control plane** that sits between an agent's reasoning and its wallet. Given a task and a budget, it:

1. **Decides whether to spend at all.** For each sub-goal, the agent first asks: can this be answered from memory or free reasoning? Only pay when paying adds signal.
2. **Chooses the best provider from memory.** Ranks known x402 providers for the needed capability by a blend of cost, latency, and past accuracy — cheapest-that-works, not just cheapest.
3. **Enforces hard guardrails before any signature.** Budget cap, per-call ceiling with human escalation, duplicate-call detection, no-progress streak, iteration backstop.
4. **Verifies every paid result.** A separate cheap LLM judge checks whether the paid response actually served the sub-goal. If not, the result is dropped (not built upon) and the provider's score falls.
5. **Records everything.** Every decision — paid, blocked, or escalated — is written to an auditable ledger with the sub-goal, provider, cost, guardrail outcome, verify verdict, and on-chain tx hash.
6. **Puts both ledgers on one screen.** Reasoning cost (BTL Runtime, metered) and tool cost (x402, on-chain) are shown together, so you can see the agent trading "spend more on thinking" vs "buy the answer."

## Why this wins *this* hackathon

The BTL Runtime Hackathon rewards **"best use of the runtime"** and BTL's whole thesis is **memory + judgment + restraint** ("systems should show up only when the signal is high enough; taste is a moat"). Mizan is the literal embodiment of that thesis applied to money:

- **Runtime as the brain** — reasoning, tool-calling, streaming, multi-provider routing, and the metered cost headers are all load-bearing, not decorative.
- **Memory** — cross-session provider learning is exactly the RetainDB story.
- **Judgment & restraint** — the guardrails and the verify step *are* selective attention applied to spending.
- **A judge already said BTL cares about x402.** Mizan is the most on-thesis way to answer that interest — and it's the version almost no other team will build, because most will build "an agent that pays," not "an agent that refuses to."

## The differentiator in one sentence

> Most teams will demo an agent that pays for tools. Mizan demos an agent that **decides not to pay, remembers why, verifies what it bought, and proves every decision** — a spending control plane, not a payment demo.

## Halal framing (a genuine differentiator)

Every economic action in Mizan is spot payment in USDC for a service actually rendered. No interest, no lending or yield, no leverage, no perpetuals, no betting or prediction-market mechanics, no custody of others' funds — the wallet is the user's own and non-custodial. This is both a values fit and a clean separation from the gambling-adjacent x402 demos that tend to appear at these events.

## Non-goals (explicitly out of scope for 48h)

- On-chain spend-cap smart contract (roadmap: ERC-4337 session keys enforce caps on-chain).
- A networked, multi-user provider reputation system (roadmap: write verdicts to ERC-8004 with proof-of-payment).
- A React Native mobile app (web dashboard demos better).
- Mainnet / real-money settlement (testnet is fine and safer for a demo).
