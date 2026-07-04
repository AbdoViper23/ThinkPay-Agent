// Provider memory (docs/03) — the RetainDB-style learning that makes the warm run cheaper.
// Pure ranking/EMA core (no DB) + thin DB wrappers. chooseProvider() is the loop's only seam.
import { eq } from "drizzle-orm";
import { db, providers } from "@thinkpay/shared/db/client";
import { CATALOG, catalogFor } from "@thinkpay/shared";
import type { Capability, ProviderStat } from "@thinkpay/shared";

const DEFAULT_LATENCY_MS = 1500;
const ACCURACY_PRIOR = 0.5;

// Ranking weights (pinned, docs/03): accuracy dominates, then cost, then latency. Higher = better.
const W_ACC = 1.0;
const W_COST = 0.5;
const W_LAT = 0.2;
// A provider whose accuracy falls below this is rejected when an above-floor peer exists.
const MIN_ACCURACY = 0.25;
// EMA weight for the accuracy update after each verify verdict.
const ALPHA = 0.3;

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

// ── Pure ranking + EMA core (no DB — unit-testable) ──────────────────────────

/** Min-max over the candidate set, clamped to [0,1]. Single/all-equal set → 0 (no discrimination). */
export function normalize(x: number, all: number[]): number {
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return hi === lo ? 0 : (x - lo) / (hi - lo);
}

/** Score one provider against its peers for the same capability. Higher = better. */
export function score(p: ProviderStat, peers: ProviderStat[]): number {
  const costs = peers.map((q) => q.avgCostAtomic);
  const lats = peers.map((q) => q.avgLatencyMs);
  return (
    W_ACC * p.accuracyScore -
    W_COST * normalize(p.avgCostAtomic, costs) -
    W_LAT * normalize(p.avgLatencyMs, lats)
  );
}

/**
 * Rank a candidate set (same capability) by score desc, with a reject floor: drop any provider
 * whose accuracyScore < MIN_ACCURACY WHEN an above-floor alternative exists. If ALL are below
 * the floor, keep them (best-effort) and let verify catch failures. Attaches score + rank.
 */
export function rankStats(stats: ProviderStat[]): ProviderStat[] {
  const scored = stats.map((p) => ({ ...p, score: score(p, stats) }));
  const aboveFloor = scored.filter((p) => p.accuracyScore >= MIN_ACCURACY);
  const pool = aboveFloor.length > 0 ? aboveFloor : scored;
  pool.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return pool.map((p, i) => ({ ...p, rank: i + 1 }));
}

/** EMA/incremental-mean update after one paid call + verify verdict. Pure — returns the next stats. */
export function applyUpdate(
  p: ProviderStat,
  o: { costAtomic: number; latencyMs: number; ok: boolean },
): Pick<ProviderStat, "avgCostAtomic" | "avgLatencyMs" | "accuracyScore" | "timesUsed" | "lastUsed"> {
  const n = p.timesUsed;
  return {
    avgCostAtomic: Math.round((p.avgCostAtomic * n + o.costAtomic) / (n + 1)),
    avgLatencyMs: Math.round((p.avgLatencyMs * n + o.latencyMs) / (n + 1)),
    accuracyScore: ALPHA * (o.ok ? 1 : 0) + (1 - ALPHA) * p.accuracyScore,
    timesUsed: n + 1,
    lastUsed: Date.now(),
  };
}

// ── DB-backed wrappers ───────────────────────────────────────────────────────

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
 * Ensure EVERY catalog provider for a capability has a row (cold-start values for new ones),
 * so ranking always sees the full candidate set — e.g. both the good and the bad liquidity
 * provider — instead of only the first-found. Existing (seeded/learned) rows are left untouched.
 */
function ensureCandidates(capability: Capability): void {
  for (const entry of catalogFor(capability)) {
    db.insert(providers)
      .values({
        endpoint: entry.endpoint,
        name: entry.name,
        capability: entry.capability,
        network: entry.network,
        priceAtomic: entry.priceAtomic,
        avgCostAtomic: entry.priceAtomic,
        avgLatencyMs: DEFAULT_LATENCY_MS,
        accuracyScore: ACCURACY_PRIOR,
        timesUsed: 0,
        lastUsed: null,
      })
      .onConflictDoNothing()
      .run();
  }
}

/** Providers for a capability, ranked best-first (score + reject floor). */
export function rankProviders(capability: Capability): ProviderStat[] {
  ensureCandidates(capability);
  const rows = db.select().from(providers).where(eq(providers.capability, capability)).all();
  return rankStats(rows.map(rowToStat));
}

/**
 * Every known provider, scored + ranked WITHIN its capability, best-first — but WITHOUT the reject
 * floor drop. This is the read model for GET /providers: the dashboard must still SEE the demoted
 * bad provider (rank 2, "avoid"), whereas rankProviders() drops it so the loop never PAYS it.
 */
export function allProvidersRanked(): ProviderStat[] {
  const rows = db.select().from(providers).all().map(rowToStat);
  const byCap = new Map<Capability, ProviderStat[]>();
  for (const p of rows) {
    const list = byCap.get(p.capability) ?? [];
    list.push(p);
    byCap.set(p.capability, list);
  }
  const out: ProviderStat[] = [];
  for (const peers of byCap.values()) {
    const scored = peers
      .map((p) => ({ ...p, score: score(p, peers) }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((p, i) => ({ ...p, rank: i + 1 }));
    out.push(...scored);
  }
  return out;
}

/**
 * Choose which provider to pay for a capability. Memory wins if it has candidates; discover()
 * is the safety net. This is the loop's only touchpoint — the warm-run advantage lives here.
 */
export function chooseProvider(capability: Capability): ProviderStat {
  return rankProviders(capability)[0] ?? discover(capability);
}

/**
 * Record the outcome of one paid call + verify verdict into the providers table (EMA accuracy +
 * incremental cost/latency means + timesUsed + lastUsed). This is what makes the warm run smarter:
 * a verify=false result drops the provider's accuracy so ranking demotes/floors it next time.
 */
export function update(endpoint: string, o: { costAtomic: number; latencyMs: number; ok: boolean }): void {
  const row = db.select().from(providers).where(eq(providers.endpoint, endpoint)).get();
  if (!row) return; // nothing to update (provider was never discovered)
  db.update(providers).set(applyUpdate(rowToStat(row), o)).where(eq(providers.endpoint, endpoint)).run();
}
