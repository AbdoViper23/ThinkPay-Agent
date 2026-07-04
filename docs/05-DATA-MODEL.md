# 05 — Data Model (`packages/shared/src/db`)

SQLite via Drizzle ORM, driver `better-sqlite3`. Three tables. All money stored as **integer atomic USDC units (6 decimals)** — never floats.

## Schema (`schema.ts`)

```ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Persists ACROSS runs — this is the learning that makes the warm run cheaper.
export const providers = sqliteTable("providers", {
  endpoint:      text("endpoint").primaryKey(),        // e.g. http://localhost:4021/holders
  name:          text("name").notNull(),               // "Provider A"
  capability:    text("capability").notNull(),         // "holders" | "liquidity" | "audit"
  network:       text("network").notNull().default("eip155:84532"),
  priceAtomic:   integer("price_atomic").notNull(),    // catalog LIST price — the pre-payment estCost source (never 0)
  avgCostAtomic: integer("avg_cost_atomic").notNull(), // OBSERVED rolling mean; INITIALIZE to priceAtomic on insert (not 0)
  avgLatencyMs:  integer("avg_latency_ms").notNull(),  // OBSERVED rolling mean; INITIALIZE to 1500 on insert (not 0)
  accuracyScore: real("accuracy_score").notNull().default(0.5), // EMA of verify verdicts, 0..1
  timesUsed:     integer("times_used").notNull().default(0),
  lastUsed:      integer("last_used"),                 // epoch ms
});
```

> **Cold-start rule (do not skip):** `avgCostAtomic`/`avgLatencyMs` are the *observed* averages and must be **initialized to `priceAtomic` / `1500`**, never `0`. A zero here makes an unseen provider `normalize()` to "free and instant" and out-rank a proven one — inverting the ranking and breaking the warm-run demo (see `03` memory scoring). `discover()` upserts with these initial values; the seed sets them explicitly.

```ts

// One row per agent run.
export const runs = sqliteTable("runs", {
  id:                 text("id").primaryKey(),
  task:               text("task").notNull(),
  budgetAtomic:       integer("budget_atomic").notNull(),
  perCallLimitAtomic: integer("per_call_limit_atomic").notNull(),
  spentToolsAtomic:   integer("spent_tools_atomic").notNull().default(0),
  reasoningCostMicros:integer("reasoning_cost_micros").notNull().default(0), // BTL cost, micro-dollars
  savedByCacheAtomic: integer("saved_by_cache_atomic").notNull().default(0),
  savedByMemoryAtomic:integer("saved_by_memory_atomic").notNull().default(0),
  status:             text("status").notNull().default("running"), // running|awaiting_approval|done|stopped|error
  createdAt:          integer("created_at").notNull(),
});

// The audit ledger — every decision, paid or not. Powers the live feed + final report.
export const decisions = sqliteTable("decisions", {
  id:              text("id").primaryKey(),
  runId:           text("run_id").notNull(),
  subGoal:         text("sub_goal").notNull(),
  capability:      text("capability"),                  // null on free `answer` / no-provider rows
  provider:        text("provider"),                    // endpoint, null if none chosen (blocked/backstop/free)
  estCostAtomic:   integer("est_cost_atomic").notNull().default(0),
  paidCostAtomic:  integer("paid_cost_atomic"),         // null if not paid
  guardrail:       text("guardrail").notNull(),         // pay|use_cache|block|escalate|pending
  guardrailReason: text("guardrail_reason"),
  verifyOk:        integer("verify_ok", { mode: "boolean" }), // null if not verified
  verifyReason:    text("verify_reason"),
  txHash:          text("tx_hash"),                     // on-chain settlement receipt
  savedAtomic:     integer("saved_atomic").notNull().default(0), // canonical name; on use_cache = avoided est cost
  createdAt:       integer("created_at").notNull(),
});
```

## Shared provider catalog (`packages/shared/src/catalog.ts`) — single source of truth for prices

`estCostAtomic` is needed by the guardrails **before** any 402 response, so the price cannot come from the wire. It comes from one catalog that is imported by **both** `discover()` (agent side) and the mock-provider (server side), so a price is defined in exactly one place and can never drift between what the guard estimates and what the seller charges.

```ts
import { dollarsToAtomic } from "./usdc";

export interface CatalogEntry {
  endpoint: string; name: string; capability: "holders" | "liquidity" | "audit";
  network: string; priceAtomic: number;
}

export const CATALOG: CatalogEntry[] = [
  { endpoint: "http://localhost:4021/holders",       name: "Provider A", capability: "holders",   network: "eip155:84532", priceAtomic: dollarsToAtomic(0.008) },
  { endpoint: "http://localhost:4021/liquidity",     name: "Provider C", capability: "liquidity", network: "eip155:84532", priceAtomic: dollarsToAtomic(0.010) },
  { endpoint: "http://localhost:4021/liquidity-bad", name: "Provider B", capability: "liquidity", network: "eip155:84532", priceAtomic: dollarsToAtomic(0.012) }, // the bad one — off-topic data
  { endpoint: "http://localhost:4021/audit",         name: "Provider D", capability: "audit",     network: "eip155:84532", priceAtomic: dollarsToAtomic(0.060) },
];
```

The mock-provider builds its `paymentMiddleware` route prices from these same atomic values (`07`). `discover(capability)` returns the catalog entry for that capability and upserts it into `providers` with `avgCostAtomic = priceAtomic`, `avgLatencyMs = 1500`, `accuracyScore = 0.5`.

## Drizzle config (`drizzle.config.ts`, repo root) — **required** or `pnpm db:push` fails

`drizzle-kit push`/`generate` need a config file the earlier drafts never mentioned; without it `pnpm db:push` errors out. Add devDeps `drizzle-kit` + `@types/better-sqlite3` and:

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/shared/src/db/schema.ts",
  dbCredentials: { url: "./mizan.db" },
});
```

`pnpm db:push` = `drizzle-kit push`; `pnpm db:seed` = `tsx packages/shared/src/db/seed.ts`.

## USDC atomic helpers (`packages/shared/src/usdc.ts`)

```ts
export const USDC_DECIMALS = 6;
export const dollarsToAtomic = (usd: number) => Math.round(usd * 10 ** USDC_DECIMALS); // $0.10 -> 100000
export const atomicToDollars = (a: number) => a / 10 ** USDC_DECIMALS;
export const formatUsd = (a: number) => `$${atomicToDollars(a).toFixed(3)}`;
```

Use these everywhere. The one hard rule: **USDC is 6 decimals, not 18.** A price of `$0.01` is `10000` atomic units.

## Seed data (`pnpm db:seed`)

Seed from `CATALOG`. To make "the agent skipped the bad one" visible, the **same capability** must have both a good and a bad provider:
- `liquidity`: **Provider C** (good — accuracy `0.95`, `avgCost = 0.010`) **and** **Provider B** → `/liquidity-bad` (bad — accuracy `0.20`, i.e. below the `MIN_ACCURACY = 0.25` reject floor, `avgCost = 0.012`). Because they share the `liquidity` capability, ranking floors out B and picks C.
- `holders`: **Provider A** (accuracy `0.98`, `avgCost = 0.008`).
- `audit`: **Provider D** (`avgCost = 0.060` — deliberately above the `$0.05` per-call limit so the escalation beat fires).

Set each seeded row's `priceAtomic` from the catalog, `avgCostAtomic = priceAtomic`, `avgLatencyMs` (e.g. C=900, B=2100, A=1200), `timesUsed` a small non-zero (e.g. 3–5), and `lastUsed = now`. The mock-provider endpoints (`07`) mirror these so the seeded providers actually resolve and pay on Base Sepolia.

## Baseline for "saved by memory" — one deterministic formula

`savedByMemory` is defined **one** way (retiring the ambiguous "first-found vs worst-case" wording): a **naive** agent pays, for every sub-goal, the **most expensive catalog provider** for that sub-goal's capability, once per sub-goal, with no dedupe and no skip.

```ts
baselineAtomic = sum over subGoals of max(priceAtomic of all catalog providers for subGoal.capability)
savedByMemoryAtomic = max(0, baselineAtomic - spentToolsAtomic)   // computed post-hoc from the same sub-goal list
```

Computed **post-hoc** (after the run, from the recorded sub-goal list) so it is deterministic and reproducible for the demo — it does not depend on the live, nondeterministic order of paid calls. `savedByCache` (duplicate avoidance) is tracked separately as the sum of per-decision `savedAtomic`.

## Demo state machine (cold vs warm) — nail the ordering

The whole "saved by memory" story depends on a clean before/after. The **cold run is genuinely cold** (empty provider memory); the seed is for a *guaranteed* fallback, not run 1:

1. `pnpm db:push` then **reset** the `providers` table (empty) — cold memory.
2. **Cold run**: memory empty → agent explores, pays a bad provider (verify drops it → its accuracy falls below the floor), hits a duplicate guard, escalates the audit. Real outcomes get recorded into `providers`.
3. **Warm run** (same task): reads the memory written by run 1 → floors out the bad provider, goes straight to the best-scored ones, fewer calls, lower spend. `savedByMemoryAtomic` counts up.
4. **Fallback for the recording:** if live run-1 behavior is flaky, `pnpm db:seed` writes the exact good+bad state above so run 2 still shows the delta. Pin the demo task string in the repo (e.g. `packages/shared/src/demo.ts`) and run `plan()` at `temperature: 0` (optionally behind a `DEMO=1` flag returning a canned plan) so the recorded ledger sequence is reproducible.
