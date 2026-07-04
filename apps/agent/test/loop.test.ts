// Offline integration test for the loop: mocks the BRAIN (btl) and the SIGNER (pay),
// but drives the REAL guardrails + memory + ledger + SQLite. Proves the Phase 2 mechanics
// (pay → ledger trace, duplicate → use_cache with one payment, budget cap → block)
// deterministically without any BTL key or funded wallet.
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, decisions, runs } from "@thinkpay/shared/db/client";
import { dollarsToAtomic } from "@thinkpay/shared";

const h = vi.hoisted(() => ({
  plan: vi.fn(),
  turnQueue: [] as unknown[],
  payCalls: [] as Array<{ endpoint: string; estCostAtomic: number }>,
}));

vi.mock("../src/btl", () => ({
  plan: h.plan,
  chatTurn: vi.fn(async () => ({ msg: h.turnQueue.shift(), costMicros: 100 })),
  compose: vi.fn(async () => ({ text: "report", costMicros: 50 })),
  verify: vi.fn(async () => ({ ok: true, reason: "stub" })),
  JUDGE_MODEL: "judge",
}));

vi.mock("../src/pay/x402", () => ({
  PaymentError: class PaymentError extends Error {},
  pay: vi.fn(async (req: { endpoint: string; estCostAtomic: number; args?: unknown }) => {
    h.payCalls.push({ endpoint: req.endpoint, estCostAtomic: req.estCostAtomic });
    return { data: { ok: true, endpoint: req.endpoint }, txHash: "0xdeadbeef00", costAtomic: req.estCostAtomic, latencyMs: 5 };
  }),
}));

// import AFTER the mocks are registered
const { runLoop } = await import("../src/loop");
const { createRun } = await import("../src/ledger");

let n = 0;
const toolMsg = (name: string, args: Record<string, unknown>) => ({
  role: "assistant",
  content: null,
  tool_calls: [{ id: `call_${n++}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
});
const answerMsg = (summary: string) => ({
  role: "assistant",
  content: null,
  tool_calls: [{ id: `call_${n++}`, type: "function", function: { name: "answer", arguments: JSON.stringify({ summary }) } }],
});

const createdRunIds: string[] = [];
function startRun(budgetUsd: number, perCallLimitUsd = 0.05) {
  const run = createRun({ task: "test", budgetUsd, perCallLimitUsd });
  createdRunIds.push(run.runId);
  return run;
}

beforeEach(() => {
  h.turnQueue.length = 0;
  h.payCalls.length = 0;
  h.plan.mockReset();
});

afterAll(() => {
  for (const id of createdRunIds) {
    db.delete(decisions).where(eq(decisions.runId, id)).run();
    db.delete(runs).where(eq(runs.id, id)).run();
  }
});

describe("runLoop (offline, mocked brain + signer)", () => {
  it("pays once, then serves the duplicate from cache (wallet charged once)", async () => {
    h.plan.mockResolvedValueOnce({
      subGoals: [
        { id: "s1", text: "holders of XYZ", capability: "holders" },
        { id: "s2", text: "holders of XYZ again", capability: "holders" },
      ],
      costMicros: 200,
    });
    // sub-goal 1: pay then answer; sub-goal 2: same call (dedupe) then answer
    h.turnQueue.push(toolMsg("get_holders", { query: "XYZ" }), answerMsg("done1"));
    h.turnQueue.push(toolMsg("get_holders", { query: "XYZ" }), answerMsg("done2"));

    const run = startRun(0.25);
    const { totals } = await runLoop(run, { task: "test", budgetUsd: 0.25, perCallLimitUsd: 0.05 });

    // exactly one on-chain payment
    expect(h.payCalls).toHaveLength(1);
    expect(totals.calls).toBe(1);

    const rows = db.select().from(decisions).where(eq(decisions.runId, run.runId)).all();
    const paid = rows.filter((r) => r.guardrail === "pay");
    const cached = rows.filter((r) => r.guardrail === "use_cache");
    expect(paid).toHaveLength(1);
    expect(cached).toHaveLength(1);

    // full ledger trace on the paid row
    expect(paid[0]!.provider).toBe("http://localhost:4021/holders");
    expect(paid[0]!.txHash).toBe("0xdeadbeef00");
    expect(paid[0]!.paidCostAtomic).toBe(dollarsToAtomic(0.008));
    expect(paid[0]!.verifyOk).toBe(true);

    // dedupe accounting
    expect(cached[0]!.savedAtomic).toBe(dollarsToAtomic(0.008));
    expect(totals.savedByCacheAtomic).toBe(dollarsToAtomic(0.008));
    expect(totals.toolAtomic).toBe(dollarsToAtomic(0.008));
    // both BTL turns + plan + compose recorded reasoning cost
    expect(totals.reasoningMicros).toBeGreaterThan(0);
  });

  it("blocks a paid call that would exceed the total budget (cap works, wallet untouched)", async () => {
    h.plan.mockResolvedValueOnce({
      subGoals: [{ id: "s1", text: "holders of XYZ", capability: "holders" }],
      costMicros: 100,
    });
    h.turnQueue.push(toolMsg("get_holders", { query: "XYZ" }), answerMsg("done"));

    const run = startRun(0.001); // $0.001 budget; holders costs $0.008 → over budget
    const { totals } = await runLoop(run, { task: "test", budgetUsd: 0.001, perCallLimitUsd: 0.05 });

    expect(h.payCalls).toHaveLength(0); // never signed
    expect(totals.toolAtomic).toBe(0);

    const rows = db.select().from(decisions).where(eq(decisions.runId, run.runId)).all();
    const blocked = rows.filter((r) => r.guardrail === "block");
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.guardrailReason).toBe("over budget");
  });

  it("auto-approves an over-per-call escalation in console mode, then pays (budget permitting)", async () => {
    h.plan.mockResolvedValueOnce({
      subGoals: [{ id: "s1", text: "audit XYZ", capability: "audit" }],
      costMicros: 100,
    });
    h.turnQueue.push(toolMsg("audit_contract", { address: "0xabc" }), answerMsg("done"));

    // audit costs $0.06 > per-call $0.05 → escalate → console auto-approve → pay (budget $0.25 ok)
    const run = startRun(0.25, 0.05);
    const { totals } = await runLoop(run, { task: "test", budgetUsd: 0.25, perCallLimitUsd: 0.05 });

    expect(totals.escalations).toBe(1);
    expect(h.payCalls).toHaveLength(1);
    expect(totals.toolAtomic).toBe(dollarsToAtomic(0.06));

    const rows = db.select().from(decisions).where(eq(decisions.runId, run.runId)).all();
    // the pending row transitioned in place to a paid row
    expect(rows.filter((r) => r.guardrail === "pay")).toHaveLength(1);
    expect(rows.filter((r) => r.guardrail === "pending")).toHaveLength(0);
  });
});
