// Phase 4: the streaming + human-approval hooks on runLoop. Same offline harness as loop.test.ts
// (mocked BRAIN + SIGNER, real guardrails/memory/ledger/SQLite). Proves the SSE-facing behavior:
// event ordering, and that an escalation genuinely SUSPENDS on awaitApproval (approve → pays,
// deny → blocks, wallet untouched). This is what acceptance check #2 rides on.
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, decisions, runs } from "@thinkpay/shared/db/client";
import { dollarsToAtomic } from "@thinkpay/shared";
import type { RunEvent } from "@thinkpay/shared";

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

describe("runLoop hooks (Phase 4 — streaming + human approval)", () => {
  it("streams a normal paid call as decision(paying) → decision:update(paid), plus status events", async () => {
    h.plan.mockResolvedValueOnce({
      subGoals: [{ id: "s1", text: "holders of XYZ", capability: "holders" }],
      costMicros: 100,
    });
    h.turnQueue.push(toolMsg("get_holders", { query: "XYZ" }), answerMsg("done"));

    const events: RunEvent[] = [];
    const run = startRun(0.25);
    await runLoop(run, { task: "test", budgetUsd: 0.25, perCallLimitUsd: 0.05 }, { emit: (e) => events.push(e) });

    const statuses = events.filter((e) => e.type === "status").map((e) => (e.data as { state: string }).state);
    expect(statuses).toContain("planning");
    expect(statuses).toContain("running");

    const first = events.find((e) => e.type === "decision");
    const upd = events.find((e) => e.type === "decision:update");
    expect(first).toBeDefined();
    expect(upd).toBeDefined();
    // the row streams as "paying" (guardrail pay, not yet paid) BEFORE the payment settles
    expect((first!.data as { guardrail: string }).guardrail).toBe("pay");
    expect((first!.data as { paidCostAtomic: number | null }).paidCostAtomic).toBeNull();
    // then resolves in place (same id) with the settled cost + verdict
    expect((upd!.data as { id: string }).id).toBe((first!.data as { id: string }).id);
    expect((upd!.data as { paidCostAtomic: number }).paidCostAtomic).toBe(dollarsToAtomic(0.008));
    expect((upd!.data as { verifyOk: boolean }).verifyOk).toBe(true);
    // the loop never emits `done` — the server owns that
    expect(events.some((e) => e.type === "done")).toBe(false);
  });

  it("suspends on awaitApproval; APPROVE → pending row resolves to paid, and it pays", async () => {
    h.plan.mockResolvedValueOnce({ subGoals: [{ id: "s1", text: "audit XYZ", capability: "audit" }], costMicros: 100 });
    h.turnQueue.push(toolMsg("audit_contract", { address: "0xabc" }), answerMsg("done"));

    const events: RunEvent[] = [];
    const approvalArgs: Array<{ decisionId: string; reason: string }> = [];
    const run = startRun(0.25, 0.05); // audit $0.06 > per-call $0.05 → escalate

    const { totals } = await runLoop(
      run,
      { task: "test", budgetUsd: 0.25, perCallLimitUsd: 0.05 },
      {
        emit: (e) => events.push(e),
        awaitApproval: async (decisionId, reason) => {
          approvalArgs.push({ decisionId, reason });
          return true; // human approves
        },
      },
    );

    // awaitApproval was actually invoked, and BEFORE any payment
    expect(approvalArgs).toHaveLength(1);
    expect(totals.escalations).toBe(1);
    expect(h.payCalls).toHaveLength(1);

    // ordering: decision(pending) → escalation(same id) → decision:update(pay)
    const pending = events.find((e) => e.type === "decision" && (e.data as { guardrail: string }).guardrail === "pending");
    const esc = events.find((e) => e.type === "escalation");
    const update = events.find((e) => e.type === "decision:update");
    expect(pending).toBeDefined();
    expect(esc).toBeDefined();
    const escId = (esc!.data as { decisionId: string }).decisionId;
    expect(escId).toBe((pending!.data as { id: string }).id);
    expect(escId).toBe(approvalArgs[0]!.decisionId);
    expect((update!.data as { guardrail: string }).guardrail).toBe("pay");
    expect((update!.data as { paidCostAtomic: number }).paidCostAtomic).toBe(dollarsToAtomic(0.06));

    // DB: the pending row transitioned in place — one paid row, zero pending left
    const rows = db.select().from(decisions).where(eq(decisions.runId, run.runId)).all();
    expect(rows.filter((r) => r.guardrail === "pay")).toHaveLength(1);
    expect(rows.filter((r) => r.guardrail === "pending")).toHaveLength(0);
  });

  it("suspends on awaitApproval; DENY → row blocked, wallet untouched", async () => {
    h.plan.mockResolvedValueOnce({ subGoals: [{ id: "s1", text: "audit XYZ", capability: "audit" }], costMicros: 100 });
    h.turnQueue.push(toolMsg("audit_contract", { address: "0xabc" }), answerMsg("done"));

    const events: RunEvent[] = [];
    const run = startRun(0.25, 0.05);

    const { totals } = await runLoop(
      run,
      { task: "test", budgetUsd: 0.25, perCallLimitUsd: 0.05 },
      { emit: (e) => events.push(e), awaitApproval: async () => false }, // human denies
    );

    expect(totals.escalations).toBe(1);
    expect(h.payCalls).toHaveLength(0); // never signed

    const update = events.find((e) => e.type === "decision:update");
    expect((update!.data as { guardrail: string }).guardrail).toBe("block");
    expect((update!.data as { guardrailReason: string }).guardrailReason).toBe("denied by human");

    const rows = db.select().from(decisions).where(eq(decisions.runId, run.runId)).all();
    expect(rows.filter((r) => r.guardrail === "block")).toHaveLength(1);
    expect(rows.filter((r) => r.guardrail === "pending")).toHaveLength(0);
  });
});
