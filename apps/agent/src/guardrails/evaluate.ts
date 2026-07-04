// The composite gate (docs/03). One pure function; every branch produces a ledger row.
// ORDER IS LOAD-BEARING: cache → backstop → no-progress → budget → per-call escalation.
// The budget check sits BEFORE the per-call check so the hard cap (#1) can never be
// bypassed — an over-budget call blocks even if it would otherwise escalate, and an
// approved over-per-call call (approved:true) skips ONLY the per-call rule; budget still runs.
import type { GuardrailResult, PaidRequest, RunState } from "./types";
import { callKey } from "./callKey";

export function evaluate(req: PaidRequest, s: RunState): GuardrailResult {
  const key = callKey(req.endpoint, req.args);

  // #3 duplicate-call detection — already paid this run → serve cached, do not pay again.
  if (s.paidCalls.has(key)) return { action: "use_cache", cachedKey: key };

  // #5 iteration backstop — absolute max loop turns / paid calls per run.
  if (s.turn >= s.maxTurns) return { action: "block", reason: "iteration backstop reached" };

  // #4 no-progress streak — N consecutive verify failures → stop.
  if (s.noProgressStreak >= s.maxNoProgress) return { action: "block", reason: "no-progress streak" };

  // #1 HARD budget cap — checked before per-call, NEVER bypassed (not even by an approval).
  if (s.spentAtomic + req.estCostAtomic > s.budgetAtomic) return { action: "block", reason: "over budget" };

  // #2 per-call ceiling — escalate unless the human already approved THIS request.
  if (!req.approved && req.estCostAtomic > s.perCallLimitAtomic) {
    return { action: "escalate", reason: "over per-call limit" };
  }

  return { action: "pay" };
}
