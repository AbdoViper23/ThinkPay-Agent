// Guardrail types (docs/03). Pure, synchronous, no network — fully unit-testable.
// This is the CANONICAL PaidRequest; the payment module (src/pay/x402.ts) imports it.

export type GuardrailResult =
  | { action: "pay" }
  | { action: "use_cache"; cachedKey: string }
  | { action: "block"; reason: string }
  | { action: "escalate"; reason: string };

export interface PaidRequest {
  endpoint: string;
  method?: "GET" | "POST";
  args?: unknown; // used for the dedupe hash; NOT sent on a GET
  estCostAtomic: number; // set by buildToolCall() from the catalog price — NEVER 0 for a real provider
  approved?: boolean; // set true only after a human approves an escalation
}

export interface RunState {
  budgetAtomic: number; // total TOOL budget (USDC atomic, 6 decimals). Reasoning cost is NOT counted here.
  spentAtomic: number; // tool spend so far this run
  perCallLimitAtomic: number;
  paidCalls: Map<string, unknown>; // key → prior result (duplicate detection)
  noProgressStreak: number;
  turn: number;
  maxTurns: number; // iteration backstop
  maxNoProgress: number; // no-progress streak limit
}
