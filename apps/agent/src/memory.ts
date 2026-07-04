// Provider memory — Phase 2 minimal. Ranking (rankProviders + score + reject floor)
// and EMA updates arrive in Phase 3; the ONLY seam the loop touches is chooseProvider().
import { eq } from "drizzle-orm";
import { db, providers } from "@thinkpay/shared/db/client";
import { CATALOG } from "@thinkpay/shared";
import type { Capability, ProviderStat } from "@thinkpay/shared";

const DEFAULT_LATENCY_MS = 1500;
const ACCURACY_PRIOR = 0.5;

function rowToStat(r: typeof providers.$inferSelect): ProviderStat {
  return {
    endpoint: r.endpoint,
    name: r.name,
    capability: r.capability as Capability,
    network: r.network,
    priceAtomic: r.priceAtomic,
    avgCostAtomic: r.avgCostAtomic,
    avgLatencyMs: r.avgLatencyMs,
    accuracyScore: r.accuracyScore,
    timesUsed: r.timesUsed,
    lastUsed: r.lastUsed ?? null,
  };
}

/**
 * Ensure a provider row exists for the capability and return it. Reads the shared catalog
 * (single source of price truth) and upserts with cold-start values (avgCost = priceAtomic,
 * avgLatency = 1500, accuracy = 0.5 — NEVER 0, which would invert the ranking). If a row
 * already exists (seeded / learned), its stats are kept — we only guarantee presence so a
 * later memory.update() (Phase 3) has a row to write.
 */
export function discover(capability: Capability): ProviderStat {
  const entry = CATALOG.find((c) => c.capability === capability);
  if (!entry) throw new Error(`no catalog provider for capability "${capability}"`);

  db.insert(providers)
    .values({
      endpoint: entry.endpoint,
      name: entry.name,
      capability: entry.capability,
      network: entry.network,
      priceAtomic: entry.priceAtomic,
      avgCostAtomic: entry.priceAtomic, // observed mean starts at list price, not 0
      avgLatencyMs: DEFAULT_LATENCY_MS,
      accuracyScore: ACCURACY_PRIOR,
      timesUsed: 0,
      lastUsed: null,
    })
    .onConflictDoNothing()
    .run();

  const row = db.select().from(providers).where(eq(providers.endpoint, entry.endpoint)).get();
  if (!row) throw new Error(`failed to upsert provider ${entry.endpoint}`);
  return rowToStat(row);
}

/**
 * Choose which provider to pay for a capability.
 * PHASE 2: just discover() (first catalog entry, upserted).
 * PHASE 3 SEAM: replace this body with `rankProviders(capability)[0] ?? discover(capability)`.
 */
export function chooseProvider(capability: Capability): ProviderStat {
  return discover(capability);
}
