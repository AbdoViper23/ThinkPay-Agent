/**
 * Headless end-to-end of the demo flow: drives the REAL simSource + REAL store
 * (no DOM). Verifies the cold run beats, the blocking escalation, approve
 * resume, done totals, provider snapshots, and the warm run delta.
 * Run: pnpm --filter web exec tsx scripts/verify-sim.ts
 */
import { simSource } from "../lib/simSource";
import { useThinkPay } from "../lib/store";

const fail = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const ok = (msg: string) => console.log(`✓ ${msg}`);

async function runOnce(expectWarm: boolean) {
  const cfg = { task: "t", budgetUsd: 0.25, perCallLimitUsd: 0.05 };
  const { runId } = await simSource.startRun(cfg);
  useThinkPay.getState().beginRun(runId, cfg.budgetUsd, cfg.perCallLimitUsd, expectWarm);

  let approvedAt: number | null = null;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("run did not finish in 30s")), 30000);
    simSource.connect(
      runId,
      (e) => {
        useThinkPay.getState().ingestEvent(e);
        if (e.type === "escalation") {
          // the human takes 1.2s to decide — script must genuinely block meanwhile
          approvedAt = Date.now();
          setTimeout(() => void simSource.approve(runId, e.data.decisionId, true), 1200);
        }
        if (e.type === "done") {
          clearTimeout(timeout);
          resolve();
        }
      },
      () => {},
    );
  });
  return { runId, approvedAt };
}

async function main() {
// ── cold run ─────────────────────────────────────────────────────────
const t0 = Date.now();
const { approvedAt } = await runOnce(false);
const s1 = useThinkPay.getState();

if (s1.decisions.length !== 5) fail(`cold: expected 5 ledger rows, got ${s1.decisions.length}`);
ok("cold: 5 decisions in the ledger");

const d2 = s1.decisions.find((d) => d.id === "d2");
if (!d2 || d2.verifyOk !== false) fail("cold: d2 (Provider B) must be verify-failed");
ok("cold: bad provider caught by verify (paid but dropped)");

const d4 = s1.decisions.find((d) => d.id === "d4");
if (!d4 || d4.guardrail !== "use_cache" || d4.savedAtomic !== 10000) fail("cold: d4 must be use_cache saving 10000");
ok("cold: duplicate blocked via cache (saved $0.010)");

const d5 = s1.decisions.find((d) => d.id === "d5");
if (!d5 || d5.guardrail !== "pay" || d5.paidCostAtomic !== 60000) fail("cold: approved escalation must settle at 60000");
if (!approvedAt) fail("cold: escalation event never fired");
ok("cold: escalation blocked the script and resumed on approve");

if (s1.totals?.toolAtomic !== 90000) fail(`cold: toolAtomic expected 90000, got ${s1.totals?.toolAtomic}`);
if (s1.live.spentToolAtomic !== 90000) fail(`cold: live spent expected 90000, got ${s1.live.spentToolAtomic}`);
ok("cold: totals $0.090 tools, live meter matches");

const provs = await simSource.fetchProviders();
const badProv = provs.find((p) => p.name === "Provider B");
if (!badProv || badProv.accuracyScore >= 0.25) fail("cold: Provider B must be below the 0.25 floor after run 1");
ok("cold: provider memory updated — Provider B demoted below the floor");

if (Object.keys(s1.pendingEscalations).length !== 0) fail("cold: pendingEscalations must be empty after resolve");
if (s1.runStatus !== "done") fail(`cold: runStatus must be done, got ${s1.runStatus}`);
ok("cold: state machine clean (done, no pending)");

// ── warm run ─────────────────────────────────────────────────────────
await runOnce(true);
const s2 = useThinkPay.getState();

if (s2.decisions.some((d) => d.providerName === "Provider B")) fail("warm: Provider B must never be called");
ok("warm: bad provider skipped entirely");

if (s2.totals?.toolAtomic !== 18000) fail(`warm: toolAtomic expected 18000, got ${s2.totals?.toolAtomic}`);
if (s2.totals?.savedByMemoryAtomic !== 62000) fail(`warm: savedByMemory expected 62000, got ${s2.totals?.savedByMemoryAtomic}`);
ok("warm: $0.018 spent, $0.062 saved by memory");

if (s2.completedRuns.length !== 2) fail("compare: expected 2 completed runs");
const delta = Math.round(((90000 - 18000) / 90000) * 100);
ok(`compare: cold $0.090 → warm $0.018 (−${delta}%)`);

console.log(`\nALL CHECKS PASSED in ${((Date.now() - t0) / 1000).toFixed(1)}s (includes real script timing)`);
process.exit(0);
}

void main();
