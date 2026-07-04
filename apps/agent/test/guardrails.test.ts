import { describe, it, expect } from "vitest";
import { dollarsToAtomic } from "@thinkpay/shared";
import { evaluate, callKey } from "../src/guardrails";
import type { PaidRequest, RunState } from "../src/guardrails";

const BUDGET = dollarsToAtomic(0.25); // 250000
const PER_CALL = dollarsToAtomic(0.05); // 50000

function state(overrides: Partial<RunState> = {}): RunState {
  return {
    budgetAtomic: BUDGET,
    spentAtomic: 0,
    perCallLimitAtomic: PER_CALL,
    paidCalls: new Map(),
    noProgressStreak: 0,
    turn: 0,
    maxTurns: 12,
    maxNoProgress: 3,
    ...overrides,
  };
}

function req(overrides: Partial<PaidRequest> = {}): PaidRequest {
  return {
    endpoint: "http://localhost:4021/holders",
    method: "GET",
    args: { query: "XYZ" },
    estCostAtomic: dollarsToAtomic(0.008), // under the per-call limit
    ...overrides,
  };
}

describe("guardrails.evaluate", () => {
  it("happy-path pay: within budget and per-call limit", () => {
    expect(evaluate(req(), state())).toEqual({ action: "pay" });
  });

  it("over-budget block: call would exceed the total tool budget", () => {
    const s = state({ spentAtomic: dollarsToAtomic(0.245) }); // 0.245 + 0.008 > 0.25
    expect(evaluate(req(), s)).toEqual({ action: "block", reason: "over budget" });
  });

  it("per-call escalate: single call over the per-call ceiling", () => {
    const r = req({ endpoint: "http://localhost:4021/audit", estCostAtomic: dollarsToAtomic(0.06) });
    expect(evaluate(r, state())).toEqual({ action: "escalate", reason: "over per-call limit" });
  });

  it("duplicate → use_cache: same (endpoint,args) already paid this run", () => {
    const r = req();
    const key = callKey(r.endpoint, r.args);
    const s = state({ paidCalls: new Map([[key, { cached: true }]]) });
    expect(evaluate(r, s)).toEqual({ action: "use_cache", cachedKey: key });
  });

  it("backstop block: iteration cap reached", () => {
    const s = state({ turn: 12, maxTurns: 12 });
    expect(evaluate(req(), s)).toEqual({ action: "block", reason: "iteration backstop reached" });
  });

  it("no-progress block: consecutive verify-failure streak reached", () => {
    const s = state({ noProgressStreak: 3, maxNoProgress: 3 });
    expect(evaluate(req(), s)).toEqual({ action: "block", reason: "no-progress streak" });
  });

  // --- ordering / bypass invariants (the whole point of guardrail #1) ---

  it("budget is checked BEFORE per-call: an over-budget AND over-per-call call blocks (not escalates)", () => {
    const r = req({ endpoint: "http://localhost:4021/audit", estCostAtomic: dollarsToAtomic(0.06) });
    const s = state({ spentAtomic: dollarsToAtomic(0.24) }); // 0.24 + 0.06 > 0.25 AND 0.06 > 0.05
    expect(evaluate(r, s)).toEqual({ action: "block", reason: "over budget" });
  });

  it("approved skips ONLY the per-call rule: an approved over-per-call call pays if within budget", () => {
    const r = req({ endpoint: "http://localhost:4021/audit", estCostAtomic: dollarsToAtomic(0.06), approved: true });
    expect(evaluate(r, state())).toEqual({ action: "pay" });
  });

  it("approval NEVER bypasses the hard budget cap", () => {
    const r = req({ estCostAtomic: dollarsToAtomic(0.06), approved: true });
    const s = state({ spentAtomic: dollarsToAtomic(0.24) }); // approved, but 0.24 + 0.06 > 0.25
    expect(evaluate(r, s)).toEqual({ action: "block", reason: "over budget" });
  });

  it("cache wins even when other limits are also breached", () => {
    const r = req();
    const key = callKey(r.endpoint, r.args);
    const s = state({ turn: 99, maxTurns: 12, paidCalls: new Map([[key, {}]]) });
    expect(evaluate(r, s)).toEqual({ action: "use_cache", cachedKey: key });
  });
});

describe("callKey", () => {
  it("is stable regardless of arg key order", () => {
    expect(callKey("e", { a: 1, b: 2 })).toBe(callKey("e", { b: 2, a: 1 }));
  });

  it("differs by endpoint and by args", () => {
    expect(callKey("e1", { a: 1 })).not.toBe(callKey("e2", { a: 1 }));
    expect(callKey("e", { a: 1 })).not.toBe(callKey("e", { a: 2 }));
  });
});
