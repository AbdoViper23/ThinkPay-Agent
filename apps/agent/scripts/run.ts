// Phase 2 console runner: plan → loop → real x402 payments → ledger. No UI.
// Usage: pnpm agent:run [--task "..."] [--budget 0.25] [--per-call 0.05]
//        DEMO=1 pnpm agent:run   # reproducible canned plan (incl. duplicate → dedupe)
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import { eq } from "drizzle-orm";
import { db, decisions, providers } from "@thinkpay/shared/db/client";
import { DEMO_TASK, DEMO_BUDGET_USD, DEMO_PER_CALL_USD, formatUsd, atomicToDollars } from "@thinkpay/shared";
import type { RunConfig } from "@thinkpay/shared";
import { createRun, finishRun } from "../src/ledger";
import { runLoop } from "../src/loop";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const cfg: RunConfig = {
  task: arg("--task") ?? DEMO_TASK,
  budgetUsd: Number(arg("--budget") ?? DEMO_BUDGET_USD),
  perCallLimitUsd: Number(arg("--per-call") ?? DEMO_PER_CALL_USD),
};

async function main() {
  console.log("═══ ThinkPay — Phase 2 run ═══");
  console.log(`task:      ${cfg.task}`);
  console.log(`budget:    $${cfg.budgetUsd.toFixed(3)}   per-call: $${cfg.perCallLimitUsd.toFixed(3)}`);
  if (process.env.DEMO === "1") console.log("mode:      DEMO (canned plan)");

  const run = createRun(cfg);
  console.log(`runId:     ${run.runId}`);

  const { totals, report } = await runLoop(run, cfg);
  finishRun(run.runId, totals); // persist run totals so cold-vs-warm survives in the runs table

  // Full ledger trace for this run (the audit trail).
  const rows = db.select().from(decisions).where(eq(decisions.runId, run.runId)).all();
  console.log("\n═══ ledger (decisions) ═══");
  for (const r of rows) {
    const cost = r.paidCostAtomic != null ? formatUsd(r.paidCostAtomic) : "—";
    const saved = r.savedAtomic ? ` saved=${formatUsd(r.savedAtomic)}` : "";
    const tx = r.txHash ? ` tx=${r.txHash.slice(0, 12)}…` : "";
    console.log(
      `  [${r.guardrail.padEnd(9)}] ${(r.capability ?? "-").padEnd(9)} ${(r.provider ?? "-").replace("http://localhost:4021", "")}` +
        `  est=${formatUsd(r.estCostAtomic)} paid=${cost}${saved} verify=${r.verifyOk === null ? "-" : r.verifyOk}${tx}`,
    );
  }

  console.log("\n═══ totals (dual ledger) ═══");
  console.log(`  tool spend (x402):   ${formatUsd(totals.toolAtomic)}  / budget ${formatUsd(run.budgetAtomic)}`);
  console.log(`  reasoning (BTL):     $${atomicToDollars(totals.reasoningMicros).toFixed(6)}`);
  console.log(`  saved by cache:      ${formatUsd(totals.savedByCacheAtomic)}`);
  console.log(`  saved by memory:     ${formatUsd(totals.savedByMemoryAtomic)}`);
  console.log(`  calls=${totals.calls}  rejections=${totals.rejections}  escalations=${totals.escalations}`);

  // Provider memory after the run — the learning that makes the next (warm) run cheaper.
  // Watch /liquidity-bad's accuracy drop after verify rejects it (Phase 3 check).
  const provRows = db.select().from(providers).all();
  console.log("\n═══ provider memory (post-run) ═══");
  for (const p of provRows) {
    console.log(
      `  ${p.name.padEnd(10)} ${p.capability.padEnd(9)} ${p.endpoint.replace("http://localhost:4021", "").padEnd(15)}` +
        ` acc=${p.accuracyScore.toFixed(2)} avgCost=${formatUsd(p.avgCostAtomic)} avgLat=${p.avgLatencyMs}ms used=${p.timesUsed}`,
    );
  }

  console.log("\n═══ report ═══");
  console.log(report || "(no report)");
}

main().catch((e) => {
  console.error("\n✗ run failed:", e?.message ?? e);
  process.exit(1);
});
