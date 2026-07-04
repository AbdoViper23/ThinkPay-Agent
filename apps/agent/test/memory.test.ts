// Pure unit tests for the provider-memory core (docs/03): normalize, score, rankStats (reject
// floor), applyUpdate (EMA), and the saved-by-memory baseline. No DB, no network — deterministic.
import { describe, it, expect } from "vitest";
import { maxPriceForCapability } from "@thinkpay/shared";
import type { ProviderStat } from "@thinkpay/shared";
import { normalize, score, rankStats, applyUpdate } from "../src/memory";

const mk = (p: Partial<ProviderStat> & Pick<ProviderStat, "name" | "accuracyScore" | "avgCostAtomic" | "avgLatencyMs">): ProviderStat => ({
  endpoint: `http://localhost:4021/${p.name}`,
  capability: "liquidity",
  network: "eip155:84532",
  priceAtomic: p.avgCostAtomic,
  timesUsed: 0,
  lastUsed: null,
  ...p,
});

describe("normalize", () => {
  it("returns 0 for a single/equal-valued set (no discrimination)", () => {
    expect(normalize(5, [5])).toBe(0);
    expect(normalize(5, [5, 5, 5])).toBe(0);
  });
  it("min-max scales into [0,1]", () => {
    expect(normalize(0, [0, 10])).toBe(0);
    expect(normalize(10, [0, 10])).toBe(1);
    expect(normalize(5, [0, 10])).toBe(0.5);
  });
});

describe("score", () => {
  it("is highest for the most accurate, cheapest, fastest provider", () => {
    const best = mk({ name: "best", accuracyScore: 1.0, avgCostAtomic: 10000, avgLatencyMs: 500 });
    const worst = mk({ name: "worst", accuracyScore: 0.5, avgCostAtomic: 12000, avgLatencyMs: 1500 });
    const peers = [best, worst];
    // best: 1.0*1 - 0.5*0 - 0.2*0 = 1.0 ; worst: 1.0*0.5 - 0.5*1 - 0.2*1 = -0.2
    expect(score(best, peers)).toBeCloseTo(1.0, 6);
    expect(score(worst, peers)).toBeCloseTo(-0.2, 6);
  });
});

describe("rankStats (reject floor)", () => {
  it("drops a below-floor provider when an above-floor alternative exists", () => {
    const good = mk({ name: "Provider C", accuracyScore: 0.95, avgCostAtomic: 10000, avgLatencyMs: 900 });
    const bad = mk({ name: "Provider B", accuracyScore: 0.2, avgCostAtomic: 12000, avgLatencyMs: 2100 });
    const ranked = rankStats([bad, good]);
    expect(ranked.map((p) => p.name)).toEqual(["Provider C"]);
    expect(ranked[0]!.rank).toBe(1);
  });

  it("keeps a below-floor provider when it is the only candidate", () => {
    const bad = mk({ name: "Provider B", accuracyScore: 0.2, avgCostAtomic: 12000, avgLatencyMs: 2100 });
    const ranked = rankStats([bad]);
    expect(ranked.map((p) => p.name)).toEqual(["Provider B"]);
  });

  it("cold-demo staging: an attractive-but-pricey bad provider out-ranks the good one FIRST", () => {
    // Provider B staged: high accuracy + low latency overcomes its higher price.
    const b = mk({ name: "Provider B", accuracyScore: 0.9, avgCostAtomic: 12000, avgLatencyMs: 500 });
    const c = mk({ name: "Provider C", accuracyScore: 0.5, avgCostAtomic: 10000, avgLatencyMs: 1500 });
    expect(rankStats([b, c])[0]!.name).toBe("Provider B");

    // After verify rejects B once, its accuracy drops and the ranking flips to C.
    const bFailed = { ...b, ...applyUpdate(b, { costAtomic: 12000, latencyMs: 300, ok: false }) };
    expect(bFailed.accuracyScore).toBeCloseTo(0.63, 6);
    expect(rankStats([bFailed, c])[0]!.name).toBe("Provider C");
  });
});

describe("applyUpdate (EMA + incremental means)", () => {
  it("moves accuracy toward 1 on ok, toward 0 on fail (ALPHA=0.3)", () => {
    const p = mk({ name: "p", accuracyScore: 0.5, avgCostAtomic: 10000, avgLatencyMs: 1000 });
    expect(applyUpdate(p, { costAtomic: 10000, latencyMs: 1000, ok: true }).accuracyScore).toBeCloseTo(0.65, 6);
    expect(applyUpdate(p, { costAtomic: 10000, latencyMs: 1000, ok: false }).accuracyScore).toBeCloseTo(0.35, 6);
  });

  it("computes a clean incremental mean for cost and latency, and bumps timesUsed", () => {
    const fresh = mk({ name: "p", accuracyScore: 0.5, avgCostAtomic: 10000, avgLatencyMs: 1500, timesUsed: 0 });
    const first = applyUpdate(fresh, { costAtomic: 8000, latencyMs: 700, ok: true });
    expect(first.avgCostAtomic).toBe(8000); // timesUsed 0 → first real value replaces the prior
    expect(first.avgLatencyMs).toBe(700);
    expect(first.timesUsed).toBe(1);

    const second = applyUpdate({ ...fresh, ...first }, { costAtomic: 12000, latencyMs: 900, ok: true });
    expect(second.avgCostAtomic).toBe(10000); // (8000*1 + 12000)/2
    expect(second.avgLatencyMs).toBe(800); // (700*1 + 900)/2
    expect(second.timesUsed).toBe(2);
  });
});

describe("saved-by-memory baseline (maxPriceForCapability)", () => {
  it("uses the MOST EXPENSIVE catalog provider per capability", () => {
    expect(maxPriceForCapability("holders")).toBe(8000);
    expect(maxPriceForCapability("liquidity")).toBe(12000); // Provider B ($0.012) > Provider C ($0.010)
    expect(maxPriceForCapability("audit")).toBe(60000);
  });
});
