// Seed the providers table (docs/05). `pnpm db:seed`.
// Guaranteed good+bad state so the cold→warm demo delta is visible even if a live
// run-1 is flaky. The SAME capability (liquidity) has a good AND a bad provider so
// ranking floors out the bad one (accuracy below MIN_ACCURACY = 0.25) and picks the good.
import { db, providers } from "./client";
import { CATALOG } from "../catalog";

const now = Date.now();

// Per-endpoint observed-state overrides (price/name/capability/network come from CATALOG).
const SEED: Record<string, { accuracyScore: number; avgLatencyMs: number; timesUsed: number }> = {
  "http://localhost:4021/holders":       { accuracyScore: 0.98, avgLatencyMs: 1200, timesUsed: 5 }, // Provider A
  "http://localhost:4021/liquidity":     { accuracyScore: 0.95, avgLatencyMs: 900,  timesUsed: 5 }, // Provider C (good)
  "http://localhost:4021/liquidity-bad": { accuracyScore: 0.20, avgLatencyMs: 2100, timesUsed: 4 }, // Provider B (bad — below 0.25 floor)
  "http://localhost:4021/audit":         { accuracyScore: 0.90, avgLatencyMs: 1500, timesUsed: 3 }, // Provider D
};

const rows = CATALOG.map((c) => {
  const s = SEED[c.endpoint];
  if (!s) throw new Error(`No seed overrides for catalog endpoint ${c.endpoint}`);
  return {
    endpoint: c.endpoint,
    name: c.name,
    capability: c.capability,
    network: c.network,
    priceAtomic: c.priceAtomic,
    avgCostAtomic: c.priceAtomic, // observed mean starts at list price (never 0 — see docs/05 cold-start rule)
    avgLatencyMs: s.avgLatencyMs,
    accuracyScore: s.accuracyScore,
    timesUsed: s.timesUsed,
    lastUsed: now,
  };
});

db.delete(providers).run();
db.insert(providers).values(rows).run();

console.log(`seeded ${rows.length} providers:`);
for (const r of rows) {
  console.log(`  ${r.name.padEnd(10)} ${r.capability.padEnd(10)} acc=${r.accuracyScore} cost=${r.avgCostAtomic} lat=${r.avgLatencyMs}ms`);
}
