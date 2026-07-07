import type { Decision, ProviderStat, RunEvent, RunTotals } from "@thinkpay/shared";

/**
 * Every demo number lives HERE and only here (docs/09 beats).
 * Cold run: explore → pay a bad provider (caught by verify) → duplicate blocked →
 * audit escalates and WAITS for the human. Warm run: memory skips the bad provider.
 * All money in atomic USDC (6dp).
 */

export type BranchStep =
  | { after: number; emit: RunEvent }
  | { after: number; providers: ProviderStat[] };

export type SimStep =
  | { at: number; emit: RunEvent }
  | { at: number; providers: ProviderStat[] }
  | {
      at: number;
      awaitApproval: {
        decisionId: string;
        timeoutMs: number;
        approved: BranchStep[];
        denied: BranchStep[];
      };
    };

/* ── endpoints (mirror the shared catalog) ─────────────────────────── */
const EP = {
  holders: "http://localhost:4021/holders",
  liquidity: "http://localhost:4021/liquidity",
  liquidityBad: "http://localhost:4021/liquidity-bad",
  audit: "http://localhost:4021/audit",
};

const HASH = {
  d1: "0xa1f39c04be6d2571c88e12097f4d6ab3902ce5148d7b6603121fdd08e94ca7b2",
  d3: "0xc3d84e19a05b7fe2461f9b30c2ad8557e6b04d9812aa30f7cd5514e00b8a61f9",
  d5: "0xd5b2277e94c1a8f05537ce6b1f30984da2ec49001b57fa8e6d33c904b17ee5a0",
  w1: "0x11e6b3d94af07c25d1885790cc42ea6f3b09d84512fe6607a92cad10f75b30c4",
  w2: "0x22f7c4ea5b018d36e2996801dd53fb704c10e9562300f718ba3dbe21086c41d5",
};

/* ── decision row builders ─────────────────────────────────────────── */
const base = (runId: string, id: string, createdAt: number): Pick<Decision, "id" | "runId" | "createdAt"> => ({
  id,
  runId,
  createdAt,
});

function coldDecisions(runId: string) {
  const d1: Decision = {
    ...base(runId, "d1", 0),
    subGoal: "Map holder distribution",
    provider: EP.holders,
    providerName: "Provider A",
    capability: "holders",
    estCostAtomic: 8000,
    paidCostAtomic: null,
    guardrail: "pay",
    guardrailReason: null,
    verifyOk: null,
    verifyReason: null,
    txHash: null,
    savedAtomic: 0,
  };
  const d2: Decision = {
    ...base(runId, "d2", 0),
    subGoal: "Measure liquidity depth",
    provider: EP.liquidityBad,
    providerName: "Provider B",
    capability: "liquidity",
    estCostAtomic: 12000,
    paidCostAtomic: null,
    guardrail: "pay",
    guardrailReason: null,
    verifyOk: null,
    verifyReason: null,
    txHash: null,
    savedAtomic: 0,
  };
  const d3: Decision = {
    ...base(runId, "d3", 0),
    subGoal: "Measure liquidity depth",
    provider: EP.liquidity,
    providerName: "Provider C",
    capability: "liquidity",
    estCostAtomic: 10000,
    paidCostAtomic: null,
    guardrail: "pay",
    guardrailReason: null,
    verifyOk: null,
    verifyReason: null,
    txHash: null,
    savedAtomic: 0,
  };
  const d4: Decision = {
    ...base(runId, "d4", 0),
    subGoal: "Cross-check liquidity (retry)",
    provider: EP.liquidity,
    providerName: "Provider C",
    capability: "liquidity",
    estCostAtomic: 10000,
    paidCostAtomic: null,
    guardrail: "use_cache",
    guardrailReason: "duplicate call — cached result reused",
    verifyOk: true,
    verifyReason: "served from cache",
    txHash: null,
    savedAtomic: 10000,
  };
  const d5: Decision = {
    ...base(runId, "d5", 0),
    subGoal: "Contract security scan",
    provider: EP.audit,
    providerName: "Provider D",
    capability: "audit",
    estCostAtomic: 60000,
    paidCostAtomic: null,
    guardrail: "pending",
    guardrailReason: "over per-call limit ($0.060 > $0.050)",
    verifyOk: null,
    verifyReason: null,
    txHash: null,
    savedAtomic: 0,
  };
  return { d1, d2, d3, d4, d5 };
}

/* ── provider memory snapshots ─────────────────────────────────────── */
export const providersEmpty: ProviderStat[] = [];

export const providersAfterCold: ProviderStat[] = [
  {
    endpoint: EP.holders,
    name: "Provider A",
    capability: "holders",
    network: "eip155:84532",
    priceAtomic: 8000,
    avgCostAtomic: 8000,
    avgLatencyMs: 1180,
    accuracyScore: 0.98,
    timesUsed: 1,
    lastUsed: Date.now(),
    score: 0.92,
    rank: 1,
  },
  {
    endpoint: EP.liquidity,
    name: "Provider C",
    capability: "liquidity",
    network: "eip155:84532",
    priceAtomic: 10000,
    avgCostAtomic: 10000,
    avgLatencyMs: 860,
    accuracyScore: 0.95,
    timesUsed: 2,
    lastUsed: Date.now(),
    score: 0.9,
    rank: 1,
  },
  {
    endpoint: EP.audit,
    name: "Provider D",
    capability: "audit",
    network: "eip155:84532",
    priceAtomic: 60000,
    avgCostAtomic: 60000,
    avgLatencyMs: 2400,
    accuracyScore: 0.9,
    timesUsed: 1,
    lastUsed: Date.now(),
    score: 0.78,
    rank: 1,
  },
  {
    endpoint: EP.liquidityBad,
    name: "Provider B",
    capability: "liquidity",
    network: "eip155:84532",
    priceAtomic: 12000,
    avgCostAtomic: 12000,
    avgLatencyMs: 2130,
    accuracyScore: 0.2, // below the 0.25 reject floor — "avoid"
    timesUsed: 1,
    lastUsed: Date.now(),
    score: 0.04,
    rank: 2,
  },
];

export const providersAfterWarm: ProviderStat[] = providersAfterCold.map((p) =>
  p.name === "Provider B"
    ? p
    : { ...p, timesUsed: p.timesUsed + 1, accuracyScore: Math.min(0.99, p.accuracyScore + 0.01), lastUsed: Date.now() },
);

/* ── totals ────────────────────────────────────────────────────────── */
const coldTotalsApproved: RunTotals = {
  reasoningMicros: 10000, // $0.010
  toolAtomic: 90000, // $0.090
  savedByCacheAtomic: 10000,
  savedByMemoryAtomic: 0,
  calls: 4,
  rejections: 1,
  escalations: 1,
};

const coldTotalsDenied: RunTotals = {
  reasoningMicros: 10000,
  toolAtomic: 30000,
  savedByCacheAtomic: 10000,
  savedByMemoryAtomic: 0,
  calls: 3,
  rejections: 1,
  escalations: 1,
};

const warmTotals: RunTotals = {
  reasoningMicros: 6000,
  toolAtomic: 18000, // $0.018
  savedByCacheAtomic: 0,
  // docs/05 baseline: max-price-per-capability 8000 + 12000 + 60000 = 80000, minus 18000 spent
  savedByMemoryAtomic: 62000,
  calls: 2,
  rejections: 0,
  escalations: 0,
};

/* ── final analysis (compose) — the agent's actual answer, shown when the run finishes ── */
const COLD_REPORT =
  "Token XYZ (0x51ab…04e2) on Base — assessment complete.\n\n" +
  "• Holder distribution: 1,873 holders; top 10 wallets hold 42% of supply (Gini 0.61) — moderate concentration risk.\n" +
  "• Liquidity depth: $1.25M TVL, $340k pool depth on Uniswap v3; ~0.28% slippage on a $10k trade — adequate for mid-size exits. (First liquidity source returned off-topic data and was rejected; a verified source was used instead.)\n" +
  "• Contract safety: security score 87/100, ownership renounced, not a honeypot, non-mintable — low risk.\n\n" +
  "Verdict: XYZ shows healthy liquidity and a clean contract, with moderate holder concentration to watch. Tool spend $0.090 of the $0.25 budget.";

const COLD_DENIED_REPORT =
  "Token XYZ (0x51ab…04e2) — partial assessment.\n\n" +
  "• Holder distribution: 1,873 holders; top 10 hold 42% (moderate concentration).\n" +
  "• Liquidity depth: verified — $1.25M TVL, ~0.28% slippage on $10k.\n" +
  "• Contract safety: NOT checked — the security scan exceeded the per-call limit and human approval was denied, so it was skipped.\n\n" +
  "Verdict: liquidity and holders look fine, but the contract was not audited. Re-run with approval for a complete safety picture.";

const WARM_REPORT =
  "Token XYZ (0x51ab…04e2) — assessment complete (warm run).\n\n" +
  "• Holder distribution: 1,873 holders; top 10 hold 42% (Gini 0.61) — moderate concentration.\n" +
  "• Liquidity depth: $1.25M TVL, ~0.28% slippage on $10k — the agent skipped the provider it learned was unreliable and paid only the trusted source.\n" +
  "• Contract safety: 87/100, ownership renounced, not a honeypot — low risk.\n\n" +
  "Verdict: same conclusions as the cold run, reached for $0.018 instead of $0.090 — provider memory avoided the wasted call entirely.";

/* ── the scripts ───────────────────────────────────────────────────── */
export function coldRunScript(runId: string): SimStep[] {
  const { d1, d2, d3, d4, d5 } = coldDecisions(runId);
  return [
    { at: 0, emit: { type: "status", data: { state: "planning" } } },
    { at: 1400, emit: { type: "status", data: { state: "running", note: "plan: 3 sub-goals" } } },

    // d1 — holders via Provider A: pay → verified
    { at: 2200, emit: { type: "decision", data: { ...d1, createdAt: 2200 } } },
    {
      at: 3100,
      emit: {
        type: "decision:update",
        data: { ...d1, createdAt: 2200, paidCostAtomic: 8000, txHash: HASH.d1, verifyOk: true, verifyReason: "holder distribution matches sub-goal" },
      },
    },

    // d2 — liquidity via Provider B: pays, then verify FAILS (the anti-garbage beat)
    { at: 4300, emit: { type: "decision", data: { ...d2, createdAt: 4300 } } },
    {
      at: 5600,
      emit: {
        type: "decision:update",
        data: {
          ...d2,
          createdAt: 4300,
          paidCostAtomic: 12000,
          txHash: "0xb2e488d10c39f6a7250447b8ee61fc8a5d3902176c00e819cb4ebf3219d752e6",
          verifyOk: false,
          verifyReason: "off-topic: returned trending memecoins, not liquidity — result dropped",
        },
      },
    },

    // d3 — liquidity via Provider C: pay → verified
    { at: 6900, emit: { type: "decision", data: { ...d3, createdAt: 6900 } } },
    {
      at: 7700,
      emit: {
        type: "decision:update",
        data: { ...d3, createdAt: 6900, paidCostAtomic: 10000, txHash: HASH.d3, verifyOk: true, verifyReason: "liquidity snapshot satisfies sub-goal" },
      },
    },

    // d4 — duplicate → use_cache (money saved, wallet untouched)
    { at: 9300, emit: { type: "decision", data: { ...d4, createdAt: 9300 } } },

    // d5 — audit $0.060 over the $0.050 per-call limit → escalate & WAIT for the human
    { at: 11000, emit: { type: "decision", data: { ...d5, createdAt: 11000 } } },
    { at: 11200, emit: { type: "escalation", data: { decisionId: "d5", reason: d5.guardrailReason ?? "over per-call limit" } } },
    {
      at: 11200,
      awaitApproval: {
        decisionId: "d5",
        timeoutMs: 60000,
        approved: [
          {
            after: 800,
            emit: {
              type: "decision:update",
              data: {
                ...d5,
                createdAt: 11000,
                guardrail: "pay",
                guardrailReason: "approved by human",
                paidCostAtomic: 60000,
                txHash: HASH.d5,
                verifyOk: true,
                verifyReason: "risk findings address the sub-goal",
              },
            },
          },
          // set the provider snapshot BEFORE done so the refetch-on-done reads the learned memory
          { after: 2400, providers: providersAfterCold },
          { after: 2401, emit: { type: "done", data: { ...coldTotalsApproved, report: COLD_REPORT } } },
        ],
        denied: [
          {
            after: 400,
            emit: {
              type: "decision:update",
              data: { ...d5, createdAt: 11000, guardrail: "block", guardrailReason: "denied by human", paidCostAtomic: null },
            },
          },
          { after: 2000, providers: providersAfterCold },
          { after: 2001, emit: { type: "done", data: { ...coldTotalsDenied, report: COLD_DENIED_REPORT } } },
        ],
      },
    },
  ];
}

export function warmRunScript(runId: string): SimStep[] {
  const { d1, d3 } = coldDecisions(runId);
  const w1: Decision = { ...d1, id: "w1", runId };
  const w2: Decision = { ...d3, id: "w2", runId, subGoal: "Measure liquidity depth (memory: skip Provider B)" };
  return [
    { at: 0, emit: { type: "status", data: { state: "planning" } } },
    { at: 900, emit: { type: "status", data: { state: "running", note: "plan: 3 sub-goals · memory: 2 known-good providers" } } },

    { at: 1500, emit: { type: "decision", data: { ...w1, createdAt: 1500 } } },
    {
      at: 2100,
      emit: {
        type: "decision:update",
        data: { ...w1, createdAt: 1500, paidCostAtomic: 8000, txHash: HASH.w1, verifyOk: true, verifyReason: "holder distribution matches sub-goal" },
      },
    },

    { at: 3000, emit: { type: "decision", data: { ...w2, createdAt: 3000 } } },
    {
      at: 3600,
      emit: {
        type: "decision:update",
        data: { ...w2, createdAt: 3000, paidCostAtomic: 10000, txHash: HASH.w2, verifyOk: true, verifyReason: "liquidity snapshot satisfies sub-goal" },
      },
    },

    // audit answered from memory this time — no third paid call needed
    {
      at: 4700,
      emit: {
        type: "decision",
        data: {
          id: "w3",
          runId,
          createdAt: 4700,
          subGoal: "Contract security scan",
          provider: null,
          providerName: null,
          capability: "audit",
          estCostAtomic: 0,
          paidCostAtomic: null,
          guardrail: "use_cache",
          guardrailReason: "answered from run-1 verified result — no payment needed",
          verifyOk: true,
          verifyReason: "memory hit",
          txHash: null,
          savedAtomic: 60000,
        },
      },
    },

    { at: 6200, providers: providersAfterWarm },
    { at: 6201, emit: { type: "done", data: { ...warmTotals, report: WARM_REPORT } } },
  ];
}
