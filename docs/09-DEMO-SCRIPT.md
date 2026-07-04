# 09 — Demo Script & Judging Points

Demo day: 5-min demo + 3-min Q&A. The submission video is 2 min. Lead with the money shot; explain the thesis second.

## The 2-minute video (submission)

1. **(0:00–0:20) The hook.** "Everyone's building agents that pay for things. The real problem is agents that pay for the *wrong* things, pay *twice*, and pay for *garbage*. Mizan is a spending conscience for agents — it decides what's worth paying for, on real money, over x402."
2. **(0:20–1:10) Cold run.** Enter the task + `$0.25` budget + `$0.05` per-call limit. Narrate as the ledger streams: pays Provider A for holders ✓; pays Provider B for liquidity → **verify flags it off-topic, result dropped, not built on**; pays Provider C instead ✓; **duplicate call blocked, $0.01 saved**; audit is `$0.06` → **over the limit, escalated → Approve**. Finishes ~`$0.098`. Point at the dual ledger: reasoning (BTL) vs tools (x402).
3. **(1:10–1:40) Warm run.** Same kind of task again. "Now it remembers." It skips the bad provider, goes straight to the best-scored ones, fewer calls, ~`$0.05`. The **"Saved by memory"** figure counts up.
4. **(1:40–2:00) The close.** "Reasoning on the BTL Runtime, payments over x402, memory and judgment in between. Spot-only USDC, non-custodial, no leverage or gambling. Not a payment demo — a control plane."

## The 5-minute live demo

Same spine, plus:
- Open the **ProviderTable** and show the bad provider demoted after the cold run — *that's* why the warm run avoids it.
- Click into one **ledger row** to show the full audit trace: sub-goal → provider → cost → guardrail outcome → verify verdict → tx hash on Base Sepolia.
- One sentence on the architecture: "The LLM only proposes tool calls. Deterministic guardrails decide the money. The wallet signs. The model never holds the key — which is also why prompt injection can't drain it."

## Talking points mapped to what BTL rewards

- **"Best use of the runtime":** reasoning, tool-calling, streaming, multi-provider routing via `btl-2`, and the metered cost headers are all load-bearing. We put the runtime's own spend on the same ledger as tool spend.
- **Memory:** cross-session provider learning is the RetainDB thesis in miniature — and it's the mechanism behind the warm-run savings.
- **Judgment & restraint:** the guardrails and verify step are selective attention applied to money. The agent's best move is often *not to spend*.
- **The x402 interest a judge raised:** this is the most on-thesis answer to it — and the version almost nobody else builds, because most build "an agent that pays," not "an agent that refuses to."

## Likely Q&A — have answers ready

- **"How does an LLM hold funds?"** It doesn't. Three layers: the model proposes tool calls; deterministic code enforces budget/dedupe/escalation; a viem wallet signs USDC via x402. The key lives only in the payment module, never in the model's context.
- **"What stops a rogue/hijacked agent from draining the wallet?"** Guardrails are code, not prompt rules — hard cap, per-call ceiling with human escalation, duplicate + no-progress + iteration backstops. Roadmap: enforce the cap on-chain with an ERC-4337 session key so even a compromised backend can't exceed it.
- **"Isn't x402 mostly hype right now?"** Cumulative numbers are big but a lot of volume is self-dealing; real commerce is early. That's exactly why the unmet need is *control and trust*, not more throughput — which is what Mizan addresses.
- **"How is this different from budget-cap wallets / provider catalogs?"** Those do one axis each. Mizan combines spend guardrails + agent-owned cross-session provider learning + per-call goal-verification. No shipping product combines all three.
- **"Real users?"** The buyer is any team running agents that spend on tools — a FinOps/control-plane need as agent tool-spend scales. Demo is testnet; the path to a hosted control plane in front of real agents is direct.
- **"Halal angle?"** Spot USDC for services rendered, non-custodial, no interest/leverage/perps/gambling. Values fit and a clean line around scope.

## One-liner to leave them with

> "An agent that spends money is only useful if it has the judgment not to. Mizan is that judgment — on the BTL Runtime, over x402."
