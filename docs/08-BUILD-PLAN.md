# 08 — Build Plan (48 hours)

> **Follow `docs/Phases.md` for actual execution** — it is the authoritative, check-gated plan against the real hard deadline (Jul 5, 15:00 UTC) with binary exit criteria per phase. This file is the detailed reference behind it (milestones, ordering rationale, fallback ladder). If the two ever disagree, `Phases.md` wins.

Order is chosen so the **demo-critical path** exists early and everything after is enhancement. If you fall behind, you cut from the bottom, not the middle.

## Hour 0–3 — Foundation + de-risk the two unknowns

- [ ] pnpm monorepo, `packages/shared` (types, `usdc.ts`, drizzle schema), `pnpm db:push`.
- [ ] **Smoke-test BTL tool-calling** (hour 1): one `btl-2` call with `tools`, confirm `tool_calls` return + read `x-btl-customer-charge`.
- [ ] **Smoke-test one x402 payment** (hour 2–3): stand up `apps/mock-provider` `/holders`, fund the buyer wallet, make one `pay()` call, confirm `200` + tx hash on Base Sepolia.
- **Milestone A:** both unknowns proven. If x402 settlement is flaky here, decide now to use a mock facilitator for the demo (the IP is guardrails+memory+verify, not the settlement plumbing).

## Hour 3–12 — The loop + guardrails (the product)

- [ ] `pay/x402.ts` finalized (only key holder).
- [ ] Guardrails as pure functions + composite `evaluate()` + **unit tests green** (over-budget, per-call escalate, duplicate→cache, backstop, no-progress, pay).
- [ ] Loop skeleton: plan → choose provider → gate → pay → (stub verify) → ledger. No UI yet; log to console.
- [ ] Ledger writes to SQLite.
- **Milestone B:** a run completes end-to-end from a script, spends real test USDC through the guardrails, and writes a full decision trail. This is a working product even with no UI.

## Hour 12–20 — Verify + memory (what makes it Mizan)

- [ ] Verify judge (`btlJudge`) wired; failing results are dropped + provider accuracy drops.
- [ ] `memory.ts` ranking + updates; `discover()` static catalog; `pnpm db:seed` with 2 good + 1 bad provider.
- [ ] Add the off-topic `/liquidity-bad` endpoint so the rejected-provider beat is real.
- **Milestone C:** run twice — cold then warm — and see fewer calls + lower spend on the warm run in the console/ledger. **This is the demo.** Everything after makes it visible.

## Hour 20–32 — Dashboard

- [ ] SSE from agent (`decision`/`status`/`done`); `POST /run`, `POST /approve`.
- [ ] Next.js page: RunControls, SpendMeter (dual ledger + "saved by memory"), LedgerFeed (live), ProviderTable.
- [ ] Escalation Approve/Deny inline control working against `POST /approve`.
- [ ] Design pass per `04-FRONTEND.md` (ledger identity, tabular monospace numbers, one animated moment).
- **Milestone D:** the twice-run story is visible and legible on screen.

## Hour 32–40 — Polish + one differentiator (only if ahead)

Pick **one**, in this priority:
- [ ] Escalation UX refinement (cheap, high impact) — already core, make it shine.
- [ ] ERC-8004 proof-of-payment-gated feedback write (shows blockchain depth).
- [ ] On-chain spend-cap via ERC-4337 session key (plays to Solidity strength).
Do not attempt more than one.

- [ ] Error/empty states in the interface's voice; reduced-motion; screen-share resolution check.

## Hour 40–46 — Demo build + recording

- [ ] Seed a clean state; rehearse the exact `09-DEMO-SCRIPT.md` sequence twice.
- [ ] Record the 2-min submission video (cold run → warm run → "saved by memory" → ledger/audit trail).
- [ ] Write the README submission blurb; state halal framing explicitly.

## Hour 46–48 — Buffer

- [ ] Freeze features. Fix only demo-breaking bugs. Submit repo + video before the hard deadline (submissions are a hard cut, no late entries).

## Fallback ladder (cut from the bottom if behind)

1. Drop the extra differentiator (hour 32–40).
2. Drop `RunCompare` chart — the animated "saved by memory" number alone tells the story.
3. Drop real third-party endpoints — mock provider only.
4. If x402 settlement won't cooperate: mock the facilitator/settlement, keep the full 402 handshake + signed payload in code, and say so honestly. Guardrails + memory + verify are the judged IP.
5. Absolute minimum winning demo: console/ledger twice-run showing cold vs warm spend, plus the SpendMeter. Everything else is polish.

## Definition of done (submission)

- Repo builds with the `CLAUDE.md` commands.
- One command path runs a task end-to-end and shows the dual ledger + saved-by-memory.
- Cold vs warm run demonstrably differs.
- Guardrail unit tests pass.
- 2-min video + README with the halal note.
