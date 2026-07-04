# 03 — Backend (`apps/agent`)

The backend is the whole product. It runs the loop, enforces guardrails, pays over x402, verifies results, learns, and streams to the dashboard.

## Runtime shape

Express server, three public routes plus an internal approval route. **Enable CORS** (`cors({ origin: "http://localhost:3000" })`) — the dashboard is cross-origin (`:3000` → `:3001`) and both the `EventSource` stream and the control POSTs will fail without it.

- `POST /run` → body `{ task: string, budgetUsd: number, perCallLimitUsd: number }` → `{ runId }`. Starts the loop async.
- `GET /run/:runId/stream` → **SSE**. Emits `status`, `decision`, `decision:update`, `escalation`, and `done` events. **On connect, replay all already-persisted decisions for this run before streaming live** (the loop runs async and a fast run can emit events before the dashboard attaches — replay from the `decisions` table closes that race).
- `GET /providers` → `ProviderStat[]` with computed `score` + `rank` for each capability. The dashboard calls this after every `done` event (and after the cold run) to populate the ProviderTable and show the bad provider demoted. There is no SSE channel for provider memory; this endpoint is it.
- `POST /run/:runId/approve` → body `{ decisionId: string, approve: boolean }` → resolves a pending escalation (see **Escalation** below). This is the exact path/payload the dashboard's inline Approve/Deny control must use.

## Shared types (`packages/shared/src/types.ts`)

The loop is only implementable once these are pinned. The **capability** is the join key between the LLM's tool call, the provider catalog, and the guardrails.

```ts
export type Capability = "holders" | "liquidity" | "audit";

export interface SubGoal {
  id: string;
  text: string;                 // natural-language sub-goal
  capability: Capability | null; // null = answerable from reasoning/memory, never paid
}

export interface RunConfig { task: string; budgetUsd: number; perCallLimitUsd: number; }

export interface ProviderStat {
  endpoint: string; name: string; capability: Capability;
  network: string; priceAtomic: number;   // catalog list price — the pre-payment cost source
  avgCostAtomic: number; avgLatencyMs: number; accuracyScore: number; // observed (rolling)
  timesUsed: number; lastUsed: number | null;
}
```

## The loop (`src/loop.ts`) — **Hybrid model**

`plan()` tags each sub-goal with a `capability` (or `null`). Then, **per sub-goal**, we call BTL with the capability-named tools so the model exercises judgment — it either calls `answer` (free) or the paid capability tool. The loop maps `tool.name → capability → provider → guardrails → pay`. The model proposes; deterministic code disposes.

```
1. plan(task)                         → SubGoal[]   (BTL btl-2, strict JSON; see 06)
2. for each subGoal:                                 // outer loop over sub-goals
   if runState.turn >= runState.maxTurns: break      // iteration backstop (hard stop)
   if runState.noProgressStreak >= runState.maxNoProgress: break

   inner loop (max INNER_TURNS_PER_SUBGOAL turns):
     runState.turn++                                 // increment on EVERY BTL round
     msg = btl.chat(messages, tools, tool_choice:"auto")
     if no tool_calls: break inner (model produced prose; treat as answered)
     for each toolCall in msg.tool_calls:            // usually one
       args = JSON.parse(toolCall.function.arguments)
       if toolCall.name === "answer":
         accumulate(args.summary); append role:"tool" (id, content); break inner  // FREE exit
       capability = TOOL_TO_CAPABILITY[toolCall.name] // identity map, see tools.ts
       provider   = memory.rankProviders(capability)[0] ?? discover(capability)
       req        = buildToolCall(provider, subGoal, toolCall)  // sets estCostAtomic = provider.priceAtomic
       decisionId = newId(); gate = guardrails.evaluate(req, runState)
       switch gate.action:
         use_cache: result = runState.paidCalls.get(gate.cachedKey)
                    savedAtomic = req.estCostAtomic          // avoided a re-pay
         block:     record blocked decision; append role:"tool" (id, "blocked: "+reason); continue
         escalate:  ledger.write(pending decision, decisionId) + SSE "escalation"{decisionId, reason}
                    approved = await awaitApproval(decisionId)   // suspends here, see Escalation
                    if !approved: record blocked; append role:"tool" (id,"denied"); continue
                    req.approved = true                          // re-run the gate; budget is STILL enforced
                    gate2 = guardrails.evaluate(req, runState)   // approved skips per-call, NOT budget
                    if gate2.action !== "pay": record blocked(gate2.reason); continue
                    result = pay(req)                            // falls through to pay
         pay:       result = pay(req)                          // x402, ONLY place that signs
       // --- post-pay state (was missing) ---
       if paid: runState.spentAtomic += result.costAtomic
                runState.paidCalls.set(callKey(req.endpoint, req.args), result)
       verdict = verify(subGoal, result)             // cheap LLM judge (JSON.stringify first)
       memory.update(provider.endpoint, { costAtomic: result.costAtomic, latencyMs: result.latencyMs, ok: verdict.ok })
       ledger.write/update(decision{decisionId, ...}) + SSE "decision" (or "decision:update" if it was pending)
       if verdict.ok: accumulate(result.data); runState.noProgressStreak = 0   // RESET on progress
       else:          runState.noProgressStreak++                              // only consecutive fails
       append role:"tool" (toolCall.id, verdict.ok ? stringify(result.data) : "result rejected by verify")
     // end inner turn
3. compose(task, verifiedResults)     → final report with per-source cost + tx hashes
4. runs.status = "done"; emit "done" (totals: reasoning µ$, tool atomic, saved-by-cache, saved-by-memory)
```

**Defaults:** `maxTurns = 12`, `maxNoProgress = 3`, `INNER_TURNS_PER_SUBGOAL = 3`. `turn` increments on **every BTL round** so the backstop bounds the inner loop too (free `answer` turns count). `noProgressStreak` tracks **consecutive** verify failures — reset to 0 on any `ok:true`.

Keep the loop deterministic and inspectable. The LLM is called only in `plan`, the per-sub-goal tool-choosing turn, `verify`, and `compose`. `decideIfPaidNeeded` is folded into the model's `answer`-vs-paid-tool choice — no separate heuristic needed.

## Tool schemas exposed to the LLM (`src/tools.ts`)

The model does not call providers directly. It calls **capability tools named 1:1 after the capabilities** (this removes the old `get_market_data`→(holders|liquidity?) ambiguity — the tool name *is* the capability). The loop maps `tool.name → capability → provider` and handles payment. Example tool definitions (OpenAI function-calling format, passed through BTL):

```ts
export const TOOL_TO_CAPABILITY = {
  get_holders:    "holders",
  get_liquidity:  "liquidity",
  audit_contract: "audit",
} as const; // "answer" is intentionally absent — it is the free exit, not a capability

const paidTool = (name: string, desc: string, props: object, required: string[]) => ({
  type: "function", function: { name, description: desc + " Costs money (paid x402 tool).",
    parameters: { type: "object", properties: props, required } },
});

export const tools = [
  paidTool("get_holders",   "Holder distribution for a token by address/symbol.", { query: { type: "string" } }, ["query"]),
  paidTool("get_liquidity", "Liquidity / TVL snapshot for a token.",             { query: { type: "string" } }, ["query"]),
  paidTool("audit_contract","Security scan of a smart contract by address.",      { address: { type: "string" } }, ["address"]),
  {
    type: "function",
    function: {
      name: "answer",
      description: "Finish the current sub-goal from information already gathered. FREE — prefer this whenever the sub-goal can be answered without paying.",
      parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
    },
  },
] as const;
```

The loop reads `tool_calls`, looks up `TOOL_TO_CAPABILITY[name]` (identity map → no ambiguity), ranks providers, gates, pays. `answer` is the free exit (its judgment "can I answer without paying?" *is* `decideIfPaidNeeded`, delegated to the model — encouraged by the tool description so restraint is the default). The `capability` that `plan()` pre-tagged on the sub-goal is used to pre-rank/warm the provider choice and to sanity-check the model's tool selection. See `06-BTL-RUNTIME.md` for the exact call (incl. the mandatory `tool_call_id` on each `role:"tool"` reply and `JSON.parse` on `arguments`).

### `buildToolCall(provider, subGoal, toolCall)`

Produces the `PaidRequest` the guardrails and `pay()` consume. **This is where `estCostAtomic` is populated — always from the catalog price, never left to default to 0:**

```ts
function buildToolCall(provider: ProviderStat, subGoal: SubGoal, toolCall): PaidRequest {
  return {
    endpoint: provider.endpoint,
    method: "GET",                       // mock endpoints are argless GETs; args are for hashing/dedupe
    args: JSON.parse(toolCall.function.arguments),
    estCostAtomic: provider.priceAtomic, // authoritative pre-payment cost (see 05 catalog)
  };
}
```

## Guardrails (`src/guardrails/`)

One pure function per rule, plus a composite gate. All synchronous, no network, fully unit-testable.

```ts
export type GuardrailResult =
  | { action: "pay" }
  | { action: "use_cache"; cachedKey: string }
  | { action: "block"; reason: string }
  | { action: "escalate"; reason: string };

export interface PaidRequest {
  endpoint: string; method?: "GET" | "POST"; args?: unknown;
  estCostAtomic: number;       // set by buildToolCall() from the catalog price — NEVER 0 for a real provider
  approved?: boolean;          // set true only after a human approves an escalation
}

export interface RunState {
  budgetAtomic: number;        // total TOOL budget (USDC atomic, 6 decimals). Reasoning cost is NOT counted here — see note.
  spentAtomic: number;         // tool spend so far this run
  perCallLimitAtomic: number;
  paidCalls: Map<string, unknown>; // key → prior result (duplicate detection)
  noProgressStreak: number;
  turn: number;
  maxTurns: number;            // iteration backstop
  maxNoProgress: number;       // no-progress streak limit
}

export function callKey(endpoint: string, args: unknown): string {
  // stable hash of endpoint + normalized args
}

export function evaluate(req: PaidRequest, s: RunState): GuardrailResult {
  const key = callKey(req.endpoint, req.args);
  if (s.paidCalls.has(key)) return { action: "use_cache", cachedKey: key };      // duplicate
  if (s.turn >= s.maxTurns) return { action: "block", reason: "iteration backstop reached" };
  if (s.noProgressStreak >= s.maxNoProgress) return { action: "block", reason: "no-progress streak" };
  // HARD budget cap — checked before per-call, and NEVER bypassed (not even by an approval).
  if (s.spentAtomic + req.estCostAtomic > s.budgetAtomic) return { action: "block", reason: "over budget" };
  // Per-call ceiling — escalate unless the human already approved THIS request.
  if (!req.approved && req.estCostAtomic > s.perCallLimitAtomic) return { action: "escalate", reason: "over per-call limit" };
  return { action: "pay" };
}
```

Order: cache → backstop → no-progress → **budget → per-call escalation**. The budget check is intentionally *before* the per-call check so guardrail #1 (hard cap) can never be bypassed — an over-budget call blocks even if it would otherwise escalate, and an approved over-per-call call (`approved:true`) skips only the per-call rule while the budget check still runs. Every branch produces a ledger row.

**Budget scope (decision):** `budgetAtomic` caps **tool (x402) spend only**. Reasoning cost (BTL) is tracked and displayed as the second ledger but is *not* subtracted from the budget or checked by guardrails. The dashboard reflects this: the spend-meter bar is tool-spend-vs-budget; reasoning is shown alongside as a separate figure (see `04`). If you ever want an all-in cap, add `reasoningCostMicros` into the budget check here and relabel the meter — but pick one; the docs assume tool-only.

## Verify step (`verify` in `src/btl.ts`)

```ts
// cheap model, temperature 0, strict yes/no + reason.
// result.data is a parsed JSON object — STRINGIFY before truncating (truncate expects a string).
const verdict = await btlJudge({
  subGoal: subGoal.text,
  response: truncate(JSON.stringify(result.data), 2000),
});
// returns { ok: boolean, reason: string }
```

If `ok === false`: do not build on `result`, drop it, increment `noProgressStreak`, lower provider accuracy. This is the anti-garbage mechanism and a headline demo beat.

## Memory (`src/memory.ts`)

Backed by the `providers` table (see `05-DATA-MODEL.md`).

```ts
// weights (pinned): accuracy dominates, then cost, then latency. Higher score = better.
const W_ACC = 1.0, W_COST = 0.5, W_LAT = 0.2;

// min-max over the CANDIDATE set for one capability, clamped to [0,1].
// Single-candidate (or all-equal) set → 0 for everyone (cost/latency don't discriminate).
function normalize(x: number, all: number[]): number {
  const lo = Math.min(...all), hi = Math.max(...all);
  return hi === lo ? 0 : (x - lo) / (hi - lo);
}

function score(p: ProviderStat, peers: ProviderStat[]): number {
  const costs = peers.map(q => q.avgCostAtomic), lats = peers.map(q => q.avgLatencyMs);
  return W_ACC * p.accuracyScore
       - W_COST * normalize(p.avgCostAtomic, costs)
       - W_LAT  * normalize(p.avgLatencyMs, lats);
}
```

- `rankProviders(capability)` → providers for that capability, sorted by `score` desc, **with a reject floor**: drop any provider whose `accuracyScore < MIN_ACCURACY` (`0.25`) *when at least one above-floor alternative exists* for the same capability. This is what deterministically makes the warm run skip the known-bad provider (its accuracy fell below the floor after being rejected by verify in the cold run) instead of merely ranking it last. If every candidate is below the floor, keep the best and let verify catch failures.
- **Cold-start (fixes the "unknown looks free" inversion):** a never-used provider must **not** default to `avgCost=0, avgLatency=0`. Initialize `avgCostAtomic = priceAtomic` (its catalog list price) and `avgLatencyMs = DEFAULT_LATENCY_MS` (`1500`); accuracy prior stays `0.5`. Otherwise `normalize(0)=0` makes an unseen provider look free *and* instant and it out-ranks a proven cheap/accurate one — the opposite of what we want, and it would break the warm-run demo.
- `update(endpoint, { costAtomic, latencyMs, ok })` — exact math:
  - `accuracyScore = ALPHA * (ok ? 1 : 0) + (1 - ALPHA) * accuracyScore`, `ALPHA = 0.3` (EMA).
  - `avgCostAtomic = round((avgCostAtomic * timesUsed + costAtomic) / (timesUsed + 1))` (incremental mean); same for `avgLatencyMs`.
  - then `timesUsed++`, `lastUsed = Date.now()`. (Seed rows start `timesUsed = 0` with `avgCost = priceAtomic`, so the first real update is a clean mean.)
- `discover(capability)` → reads the shared static catalog (`05`) and **upserts** the chosen provider into the `providers` table *before* `pay`, so a later `update(endpoint, …)` has a row to write. Returns one provider (the catalog entry for that capability); no live embedding needed for the demo.

The warm-run advantage comes entirely from this table persisting between runs. **Seed it** (`pnpm db:seed`) so run 1 vs run 2 shows a clear delta on demo day even if live behavior varies — and seed at least one **good + the bad provider for the same capability** so the good one out-ranks (or floors out) the bad one visibly.

## Ledger + SSE (`src/ledger.ts`)

```ts
interface Decision {
  id: string; runId: string; subGoal: string;
  provider: string | null;               // null on blocked/backstop/free rows (no provider chosen)
  capability: Capability | null;          // null on free `answer` / no-provider rows
  estCostAtomic: number; paidCostAtomic: number | null; // paidCostAtomic = costAtomic from pay(); null if not paid
  guardrail: GuardrailResult["action"] | "pending"; guardrailReason?: string; // "pending" while awaiting approval
  verifyOk: boolean | null; verifyReason?: string;
  txHash: string | null;
  savedAtomic: number;                    // ONE canonical name (matches the DB column). On use_cache = avoided est cost.
  createdAt: number;
}
```

The field is `savedAtomic` **everywhere** — the Decision interface, the `decisions` DB column (`05`), and the SSE payload. (The old `savedByCacheAtomic` name is retired.) On a `use_cache` decision, `savedAtomic = estCostAtomic` (the re-payment we avoided).

Every decision is persisted and pushed over SSE immediately so the dashboard animates in real time. **Units on the wire: all money in SSE payloads is integer atomic USDC (6 dp); the dashboard formats via `formatUsd` from `packages/shared`.** The final `done` event includes totals: reasoning cost (accumulated `x-btl-customer-charge` in micro-dollars — same 1e-6 USD scale as atomic USDC, so they are summable), tool cost (sum of `paidCostAtomic`), saved-by-cache, saved-by-memory (deterministic baseline, see `05`), calls, rejections, escalations. Do **not** use `/v1/usage/summary` for the per-run total — it is workspace-cumulative across all runs.

### Escalation — suspend/resume (`awaitApproval`)

The loop runs async but must pause mid-execution on a human decision that arrives via a separate HTTP call. Mechanism (single-process, in-memory — fine for the hackathon):

```ts
const pending = new Map<string, { resolve: (ok: boolean) => void; timer: NodeJS.Timeout }>();

function awaitApproval(decisionId: string, timeoutMs = 60_000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { pending.delete(decisionId); resolve(false); }, timeoutMs); // auto-DENY on timeout
    pending.set(decisionId, { resolve, timer });
  });
}

// POST /run/:runId/approve  { decisionId, approve }
function handleApprove(decisionId: string, approve: boolean) {
  const p = pending.get(decisionId);
  if (!p) return;                 // unknown/already-resolved
  clearTimeout(p.timer); pending.delete(decisionId); p.resolve(approve);
}
```

Ordering that makes this work: **mint `decisionId` and write+stream the `escalation` decision (guardrail `"pending"`) BEFORE calling `awaitApproval`** — the UI needs the id to POST back. On resolve, the loop re-runs `evaluate()` with `approved:true` (budget still enforced) and emits a `decision:update` for the same `decisionId` so the pending row transitions in place to paid/blocked (the LedgerFeed is otherwise append-only). `approve:false` (or timeout) → the row becomes `block` with reason `"denied"` / `"approval timed out"`; a denial is a skip, **not** counted as no-progress. Set `runs.status = "awaiting_approval"` while suspended (see `05`).

## Payment (`src/pay/x402.ts`)

The **only** module that imports `EVM_PRIVATE_KEY` and can sign. Exposes a single `pay(req): Promise<{ data, txHash, costAtomic, latencyMs }>`. `costAtomic` **= `req.estCostAtomic`** (the catalog price is the authoritative, known amount for our providers; the 402 `PAYMENT-REQUIRED` amount matches it). So `paidCostAtomic` in the ledger is that value. Never export the account or key. Full code (incl. `PaymentError`, the per-call timeout, and the client-cap note) in `07-X402-PAYMENTS.md`.

## Tests

`test/guardrails.test.ts` must cover: over-budget block, per-call escalate, duplicate → use_cache, backstop block, no-progress block, happy-path pay. These are pure and fast; they're also your safety net when refactoring under time pressure.
