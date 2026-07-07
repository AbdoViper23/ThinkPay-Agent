// Shared contract types — mirror docs/03 exactly. The frontend builds against these;
// the backend (Phase 2+) must implement to them.

export type Capability = "holders" | "liquidity" | "audit";

export type GuardrailAction = "pay" | "use_cache" | "block" | "escalate" | "pending";

export interface RunConfig {
  task: string;
  budgetUsd: number;
  perCallLimitUsd: number;
}

export interface SubGoal {
  id: string;
  text: string;
  capability: Capability | null; // null = answerable from reasoning/memory, never paid
}

export interface ProviderStat {
  endpoint: string;
  name: string;
  capability: Capability;
  network: string;
  priceAtomic: number; // catalog list price — pre-payment estCost source
  avgCostAtomic: number; // observed rolling mean
  avgLatencyMs: number;
  accuracyScore: number; // EMA of verify verdicts, 0..1
  timesUsed: number;
  lastUsed: number | null;
  /** computed by GET /providers */
  score?: number;
  rank?: number;
}

export interface Decision {
  id: string;
  runId: string;
  subGoal: string;
  provider: string | null; // endpoint; null on blocked/backstop/free rows
  providerName?: string | null; // display name ("Provider A") — UI convenience
  capability: Capability | null;
  estCostAtomic: number;
  paidCostAtomic: number | null; // null if not paid
  guardrail: GuardrailAction; // "pending" while awaiting approval
  guardrailReason?: string | null;
  verifyOk: boolean | null; // null if not verified
  verifyReason?: string | null;
  txHash: string | null;
  savedAtomic: number; // on use_cache = avoided est cost
  createdAt: number; // epoch ms
}

export type RunStatusState = "planning" | "running" | "awaiting_approval" | "done" | "error";

export interface RunTotals {
  reasoningMicros: number; // BTL cost, micro-dollars (same 1e-6 USD scale as atomic)
  toolAtomic: number; // sum of paidCostAtomic
  savedByCacheAtomic: number;
  savedByMemoryAtomic: number;
  calls: number;
  rejections: number;
  escalations: number;
}

/** The `done` payload: run money-totals plus the agent's final composed analysis. */
export interface RunDone extends RunTotals {
  report: string; // the compose() summary of all verified findings — the agent's actual answer
}

/** SSE wire events — GET /run/:id/stream */
export type RunEvent =
  | { type: "status"; data: { state: RunStatusState; note?: string } }
  | { type: "decision"; data: Decision }
  | { type: "decision:update"; data: Decision }
  | { type: "escalation"; data: { decisionId: string; reason: string } }
  | { type: "done"; data: RunDone };
