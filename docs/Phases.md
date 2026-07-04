# PHASES — execution plan (deadline: Jul 5, 15:00 UTC — hard cut)

Rule: **do not start a phase before the previous phase's checks pass.** If a check fails, use the listed fallback and move on. Cut from the bottom, never the middle.

---

## Phase 0 — De-risk (1–2h) ⚠️ do this first
**Do:**
- Get BTL key (registration email) into `.env`.
- One `btl-2` call with a dummy `tools` array.
- Generate buyer wallet, fund via Circle faucet, stand up ONE mock paid endpoint, make ONE `pay()` call.

**Verify:**
- [ ] BTL response contains `tool_calls` with valid JSON args AND header `x-btl-customer-charge` is present.
- [ ] `curl` to mock endpoint WITHOUT payment → `402` + `PAYMENT-REQUIRED` header.
- [ ] `pay()` → `200` + tx hash, and the hash resolves on `sepolia.basescan.org`.

**Fallback:** tools broken → use JSON-mode prompting instead of native tools. Settlement broken → mock facilitator NOW, don't fight it later.

---

## Phase 1 — Skeleton + guardrails (3–4h)
**Do:** pnpm monorepo (Phase 0 already bootstrapped it), `packages/shared` (types + `usdc.ts` + **`catalog.ts` (shared provider prices — single source of `estCostAtomic`, imported by both the agent and mock-provider)** + drizzle schema + **`drizzle.config.ts` at repo root (required or `db:push` fails)**), `db:push`, mock-provider full 4 endpoints (incl. `/liquidity-bad`), all 5 guardrails as pure functions + unit tests.

**Verify:**
- [ ] `pnpm --filter agent test` → all 6 guardrail cases green (over-budget block, per-call escalate, duplicate→cache, backstop, no-progress, pay).
- [ ] `sqlite3 mizan.db ".tables"` shows `providers runs decisions`.
- [ ] All 4 mock endpoints return 402 unpaid / 200 paid.

---

## Phase 2 — The loop, console-only (4–5h)
**Do:** plan → choose provider → `guardrails.evaluate()` → `pay()` → stub verify → ledger row per decision. Run from a script, no UI. Note: in console mode there is no human approver, so an `escalate` outcome will hang on `awaitApproval` until the 60s timeout → **auto-approve escalations in console mode** (or use a test task with no over-per-call call until Phase 4).

**Verify:**
- [ ] One script run completes end-to-end and spends real test USDC.
- [ ] `decisions` table has a full trace: sub-goal, provider, cost, guardrail, tx hash.
- [ ] Set budget to $0.01 → run gets **blocked** (proves the cap works).
- [ ] Force the same call twice → second is `use_cache`, wallet charged once (check basescan tx count).

**Milestone: this is already a working product.**

---

## Phase 3 — Verify + memory = Mizan (3h)
**Do:** wire `btlJudge`, memory ranking + EMA updates, `db:seed` (2 good + 1 bad provider), point bad provider at `/liquidity-bad`.

**Verify:**
- [ ] Cold run: `/liquidity-bad` gets `verifyOk = false` and its `accuracy_score` drops in `providers`.
- [ ] Warm run (immediately after): bad provider is NOT called; total paid calls < cold run; `spentToolsAtomic` run2 < run1.
- [ ] `savedByMemoryAtomic > 0` on run 2.

**Milestone: the demo exists. Everything after is visibility.**

---

## Phase 4 — Dashboard (5–6h)
**Do:** SSE endpoints (`POST /run`, `GET /run/:id/stream`, `POST /run/:id/approve`) + **`GET /providers` (the ProviderTable's data source — memory has no SSE channel)**, CORS for `:3000`, Next.js page: RunControls, SpendMeter (dual ledger + saved-by-memory), LedgerFeed, ProviderTable, inline Approve for escalations. Design pass per `docs/04`.

**Verify:**
- [ ] Start a run from the UI → rows stream in live (no refresh).
- [ ] The $0.06 audit call pauses the run; clicking **Approve** resumes it and it pays.
- [ ] SpendMeter totals match `runs` table numbers exactly (no float drift — atomic units only).
- [ ] Looks right at screen-share resolution; reduced-motion respected.

---

## Phase 5 — Ship (2–3h) — start no later than Jul 5, 11:00 UTC
**Do:** clean seed, rehearse twice, record 2-min video (cold → warm → saved-by-memory → ledger row with tx hash), README submission blurb + halal note, submit.

**Verify:**
- [ ] Fresh clone + `pnpm install` + commands in CLAUDE.md → runs.
- [ ] Video ≤ 2 min and shows the twice-run delta clearly.
- [ ] Submitted with buffer before 15:00 UTC (hard deadline, no late entries).

---

## Cut order if behind
1. Design polish → 2. ProviderTable → 3. real third-party endpoint (mocks only) → 4. live settlement (mock facilitator, keep the 402 handshake real, say so honestly) → 5. UI itself (console twice-run + SpendMeter screenshot still tells the story).

## Time budget from now (~37h to deadline)
~18–20h build (Phases 0–4) + ~3h ship + sleep + buffer. If Phase 2 isn't done by tonight (Jul 4, ~23:00 UTC), trigger cut order immediately.