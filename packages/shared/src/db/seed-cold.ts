// Seed the COLD-demo state (docs/05 demo state machine). `pnpm db:seed:cold`.
//
// Unlike `db:seed` (which writes the settled WARM state — the bad provider already floored),
// this stages run 1: the BAD liquidity provider (Provider B → /liquidity-bad) looks ATTRACTIVE
// (high accuracy, low latency) so ranking picks it FIRST. The cold run pays it, the verify judge
// rejects its off-topic data, and its accuracy drops (EMA) — after which the good Provider C
// out-ranks it. The warm run then skips B entirely. Everything else starts at a genuine cold prior.
//
// Ranking math check (W_ACC 1.0, W_COST 0.5, W_LAT 0.2), first cold liquidity call:
//   score(B) = 1.0*0.90 - 0.5*1(pricier) - 0.2*0(faster) = 0.40   ← picked
//   score(C) = 1.0*0.50 - 0.5*0          - 0.2*1          = 0.30
// After B fails verify (acc 0.90 → 0.63), a retry flips to C (0.30 > 0.13); the warm run keeps C.
import { db, providers } from "./client";
import { CATALOG } from "../catalog";

const now = Date.now();
const COLD_PRIOR = { accuracyScore: 0.5, avgLatencyMs: 1500, timesUsed: 0 };

// Per-endpoint overrides (price/name/capability/network come from CATALOG). Only Provider B is staged.
const SEED: Record<string, { accuracyScore: number; avgLatencyMs: number; timesUsed: number }> = {
  "http://localhost:4021/holders": COLD_PRIOR, // Provider A — cold prior
  "http://localhost:4021/liquidity": COLD_PRIOR, // Provider C (good) — cold prior
  "http://localhost:4021/liquidity-bad": { accuracyScore: 0.9, avgLatencyMs: 500, timesUsed: 1 }, // Provider B — looks great, isn't
  "http://localhost:4021/audit": COLD_PRIOR, // Provider D — cold prior
};

const rows = CATALOG.map((c) => {
  const s = SEED[c.endpoint];
  if (!s) throw new Error(`No cold-seed overrides for catalog endpoint ${c.endpoint}`);
  return {
    endpoint: c.endpoint,
    name: c.name,
    capability: c.capability,
    network: c.network,
    priceAtomic: c.priceAtomic,
    avgCostAtomic: c.priceAtomic, // observed mean starts at list price (never 0 — cold-start rule)
    avgLatencyMs: s.avgLatencyMs,
    accuracyScore: s.accuracyScore,
    timesUsed: s.timesUsed,
    lastUsed: s.timesUsed > 0 ? now : null,
  };
});

db.delete(providers).run();
db.insert(providers).values(rows).run();

console.log(`seeded ${rows.length} providers (COLD demo state — Provider B staged attractive):`);
for (const r of rows) {
  console.log(`  ${r.name.padEnd(10)} ${r.capability.padEnd(10)} acc=${r.accuracyScore} cost=${r.avgCostAtomic} lat=${r.avgLatencyMs}ms used=${r.timesUsed}`);
}
