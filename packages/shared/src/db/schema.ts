// Drizzle schema (docs/05). SQLite via better-sqlite3. Three tables.
// All money stored as integer atomic USDC units (6 decimals) — never floats.
// NODE-ONLY: never import from the browser-facing barrel (packages/shared/src/index.ts).
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Persists ACROSS runs — this is the learning that makes the warm run cheaper.
export const providers = sqliteTable("providers", {
  endpoint: text("endpoint").primaryKey(), // e.g. http://localhost:4021/holders
  name: text("name").notNull(), // "Provider A"
  capability: text("capability").notNull(), // "holders" | "liquidity" | "audit"
  network: text("network").notNull().default("eip155:84532"),
  priceAtomic: integer("price_atomic").notNull(), // catalog LIST price — pre-payment estCost source (never 0)
  avgCostAtomic: integer("avg_cost_atomic").notNull(), // OBSERVED rolling mean; INIT to priceAtomic (not 0)
  avgLatencyMs: integer("avg_latency_ms").notNull(), // OBSERVED rolling mean; INIT to 1500 (not 0)
  accuracyScore: real("accuracy_score").notNull().default(0.5), // EMA of verify verdicts, 0..1
  timesUsed: integer("times_used").notNull().default(0),
  lastUsed: integer("last_used"), // epoch ms
});

// One row per agent run.
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  task: text("task").notNull(),
  budgetAtomic: integer("budget_atomic").notNull(),
  perCallLimitAtomic: integer("per_call_limit_atomic").notNull(),
  spentToolsAtomic: integer("spent_tools_atomic").notNull().default(0),
  reasoningCostMicros: integer("reasoning_cost_micros").notNull().default(0), // BTL cost, micro-dollars
  savedByCacheAtomic: integer("saved_by_cache_atomic").notNull().default(0),
  savedByMemoryAtomic: integer("saved_by_memory_atomic").notNull().default(0),
  status: text("status").notNull().default("running"), // running|awaiting_approval|done|stopped|error
  createdAt: integer("created_at").notNull(),
});

// The audit ledger — every decision, paid or not. Powers the live feed + final report.
export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  subGoal: text("sub_goal").notNull(),
  capability: text("capability"), // null on free `answer` / no-provider rows
  provider: text("provider"), // endpoint, null if none chosen (blocked/backstop/free)
  estCostAtomic: integer("est_cost_atomic").notNull().default(0),
  paidCostAtomic: integer("paid_cost_atomic"), // null if not paid
  guardrail: text("guardrail").notNull(), // pay|use_cache|block|escalate|pending
  guardrailReason: text("guardrail_reason"),
  verifyOk: integer("verify_ok", { mode: "boolean" }), // null if not verified
  verifyReason: text("verify_reason"),
  txHash: text("tx_hash"), // on-chain settlement receipt
  savedAtomic: integer("saved_atomic").notNull().default(0), // canonical name; on use_cache = avoided est cost
  createdAt: integer("created_at").notNull(),
});
