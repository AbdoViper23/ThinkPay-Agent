// Ledger — persists runs + every decision (the audit trail + demo data source).
// Phase 2: DB only. Phase 4 adds an SSE emit hook over these same writes.
import { eq } from "drizzle-orm";
import { db, runs, decisions } from "@thinkpay/shared/db/client";
import { dollarsToAtomic } from "@thinkpay/shared";
import type { Decision, RunConfig, RunTotals } from "@thinkpay/shared";
import { newId } from "./ids";

export interface RunRecord {
  runId: string;
  budgetAtomic: number;
  perCallLimitAtomic: number;
}

/** Insert a new run row (status "running") and return its identifiers. */
export function createRun(config: RunConfig): RunRecord {
  const runId = newId();
  const budgetAtomic = dollarsToAtomic(config.budgetUsd);
  const perCallLimitAtomic = dollarsToAtomic(config.perCallLimitUsd);
  db.insert(runs)
    .values({
      id: runId,
      task: config.task,
      budgetAtomic,
      perCallLimitAtomic,
      status: "running",
      createdAt: Date.now(),
    })
    .run();
  return { runId, budgetAtomic, perCallLimitAtomic };
}

/** Persist one decision row (paid, cached, blocked, escalated, or free). */
export function writeDecision(d: Decision): void {
  db.insert(decisions)
    .values({
      id: d.id,
      runId: d.runId,
      subGoal: d.subGoal,
      capability: d.capability ?? null,
      provider: d.provider ?? null,
      estCostAtomic: d.estCostAtomic,
      paidCostAtomic: d.paidCostAtomic ?? null,
      guardrail: d.guardrail,
      guardrailReason: d.guardrailReason ?? null,
      verifyOk: d.verifyOk ?? null,
      verifyReason: d.verifyReason ?? null,
      txHash: d.txHash ?? null,
      savedAtomic: d.savedAtomic,
      createdAt: d.createdAt,
    })
    .run();
}

/** Patch an existing decision (e.g. a pending escalation resolving to paid/blocked). */
export function updateDecision(id: string, patch: Partial<Decision>): void {
  const set: Record<string, unknown> = {};
  if (patch.provider !== undefined) set.provider = patch.provider;
  if (patch.capability !== undefined) set.capability = patch.capability;
  if (patch.estCostAtomic !== undefined) set.estCostAtomic = patch.estCostAtomic;
  if (patch.paidCostAtomic !== undefined) set.paidCostAtomic = patch.paidCostAtomic;
  if (patch.guardrail !== undefined) set.guardrail = patch.guardrail;
  if (patch.guardrailReason !== undefined) set.guardrailReason = patch.guardrailReason;
  if (patch.verifyOk !== undefined) set.verifyOk = patch.verifyOk;
  if (patch.verifyReason !== undefined) set.verifyReason = patch.verifyReason;
  if (patch.txHash !== undefined) set.txHash = patch.txHash;
  if (patch.savedAtomic !== undefined) set.savedAtomic = patch.savedAtomic;
  if (Object.keys(set).length === 0) return;
  db.update(decisions).set(set).where(eq(decisions.id, id)).run();
}

/** Finalize a run with its totals. */
export function finishRun(runId: string, totals: RunTotals, status: "done" | "error" = "done"): void {
  db.update(runs)
    .set({
      spentToolsAtomic: totals.toolAtomic,
      reasoningCostMicros: totals.reasoningMicros,
      savedByCacheAtomic: totals.savedByCacheAtomic,
      savedByMemoryAtomic: totals.savedByMemoryAtomic,
      status,
    })
    .where(eq(runs.id, runId))
    .run();
}
