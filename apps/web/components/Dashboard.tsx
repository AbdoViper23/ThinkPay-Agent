"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleDot, Cpu, Play, Scale, ShieldCheck, Sparkles } from "lucide-react";
import type { Decision, ProviderStat } from "@thinkpay/shared";
import { formatUsd, DEMO_TASK, DEMO_BUDGET_USD, DEMO_PER_CALL_USD } from "@thinkpay/shared";
import { useThinkPay } from "@/lib/store";
import { startRun, respondEscalation } from "@/lib/runController";
import { useProvidersOnMount } from "@/lib/useRunStream";

const REJECT_FLOOR = 0.25;

type Phase = "Idle" | "Planning" | "Running" | "Approval" | "Done";
const PHASE_OF: Record<string, Phase> = {
  idle: "Idle",
  planning: "Planning",
  running: "Running",
  awaiting_approval: "Approval",
  done: "Done",
  error: "Idle",
};

/* ── decision → ledger row shape ───────────────────────────────────── */
type RowKind = "pay" | "dropped" | "saved" | "escalated" | "blocked";

function rowFor(d: Decision): { kind: RowKind; detail: string; amount: string } {
  if (d.guardrail === "use_cache") {
    return { kind: "saved", detail: `${d.providerName ?? "cache"} · duplicate call, cache hit`, amount: `−${formatUsd(d.savedAtomic)}` };
  }
  if (d.guardrail === "escalate" || d.guardrail === "pending") {
    return {
      kind: "escalated",
      detail: `${d.providerName ?? "provider"} · over per-call limit, needs approval`,
      amount: formatUsd(d.estCostAtomic),
    };
  }
  if (d.guardrail === "block") {
    return { kind: "blocked", detail: `${d.providerName ?? "provider"} · ${d.guardrailReason ?? "blocked"}`, amount: "—" };
  }
  // guardrail === "pay"
  if (d.verifyOk === false) {
    return {
      kind: "dropped",
      detail: `${d.providerName ?? "provider"} · off-topic, dropped`,
      amount: formatUsd(d.paidCostAtomic ?? d.estCostAtomic),
    };
  }
  return {
    kind: "pay",
    detail: `${d.providerName ?? "provider"} · verified`,
    amount: formatUsd(d.paidCostAtomic ?? d.estCostAtomic),
  };
}

export default function Dashboard() {
  useProvidersOnMount();

  const mode = useThinkPay((s) => s.mode);
  const setMode = useThinkPay((s) => s.setMode);
  const runStatus = useThinkPay((s) => s.runStatus);
  const runCount = useThinkPay((s) => s.runCount);
  const budgetAtomic = useThinkPay((s) => s.budgetAtomic);
  const live = useThinkPay((s) => s.live);
  const totals = useThinkPay((s) => s.totals);
  const report = useThinkPay((s) => s.report);
  const decisions = useThinkPay((s) => s.decisions);
  const pending = useThinkPay((s) => s.pendingEscalations);
  const providers = useThinkPay((s) => s.providers);
  const completedRuns = useThinkPay((s) => s.completedRuns);
  const error = useThinkPay((s) => s.error);
  const reset = useThinkPay((s) => s.reset);

  const [task, setTask] = useState(DEMO_TASK);
  const [budget, setBudget] = useState(DEMO_BUDGET_USD.toFixed(2));
  const [perCall, setPerCall] = useState(DEMO_PER_CALL_USD.toFixed(2));

  const running = runStatus === "planning" || runStatus === "running" || runStatus === "awaiting_approval";
  const phase = PHASE_OF[runStatus] ?? "Idle";
  const warmNext = mode === "sim" && runCount >= 1 && !running;

  const spentAtomic = live.spentToolAtomic;
  const barPct = budgetAtomic > 0 ? Math.min(1, spentAtomic / budgetAtomic) : 0;
  const reasoning = totals?.reasoningMicros ?? 0;
  const savedByMemory = totals?.savedByMemoryAtomic ?? 0;

  const run = () => {
    const budgetUsd = Number.parseFloat(budget);
    const perCallLimitUsd = Number.parseFloat(perCall);
    if (!task.trim() || !Number.isFinite(budgetUsd) || !Number.isFinite(perCallLimitUsd)) return;
    void startRun({ task: task.trim(), budgetUsd, perCallLimitUsd });
  };

  // provider memory, ranked (bad providers sink below the reject floor)
  const rankedProviders = [...providers].sort((a, b) => {
    const aBad = a.accuracyScore < REJECT_FLOOR ? 1 : 0;
    const bBad = b.accuracyScore < REJECT_FLOOR ? 1 : 0;
    if (aBad !== bBad) return aBad - bBad;
    return (b.score ?? b.accuracyScore) - (a.score ?? a.accuracyScore);
  });

  const escalationEntry = Object.entries(pending)[0];
  const escalationId = escalationEntry?.[0];

  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#12131A]">
      <AppNav phase={phase} />

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-[340px_1fr_320px]">
        {/* LEFT — controls + spend */}
        <div className="space-y-4">
          <Panel title="New run" right={<ModeToggle mode={mode} setMode={setMode} disabled={running} />}>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-[#12131A]/55">Task</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-md border border-[#12131A]/15 bg-white p-3 text-[13.5px] leading-relaxed text-[#12131A] outline-none transition-colors focus:border-[#12131A]/60"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Money label="Budget" value={budget} onChange={setBudget} />
              <Money label="Per-call limit" value={perCall} onChange={setPerCall} />
            </div>
            {warmNext && (
              <div className="mt-4 flex items-center gap-2 text-[12px] text-[#B08D3F]">
                <Sparkles className="h-3.5 w-3.5" />
                Next run is warm — it reuses provider memory.
              </div>
            )}
            <button
              onClick={run}
              disabled={running}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#12131A] py-3 text-[13.5px] font-medium text-[#F5F2EA] transition-all hover:bg-black disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {running ? "Running…" : "Run agent"}
            </button>
            {decisions.length > 0 && !running && (
              <button
                onClick={() => reset()}
                className="mt-2 w-full rounded-md border border-[#12131A]/15 py-2 text-[12px] text-[#12131A]/70 hover:bg-[#12131A]/5"
              >
                Clear ledger
              </button>
            )}
            {error && <p className="mt-3 text-[12px] leading-relaxed text-[#9B4A38]">{error}</p>}
          </Panel>

          <Panel title="Tool spend">
            <div className="flex items-baseline gap-2">
              <div className="font-mono-num text-4xl tabular text-[#12131A]">{formatUsd(spentAtomic)}</div>
              <div className="font-mono-num text-sm tabular text-[#12131A]/40">/ {formatUsd(budgetAtomic)}</div>
            </div>
            <Progress value={barPct} />
            <dl className="mt-5 space-y-2 font-mono-num text-[12.5px]">
              <Line k="Reasoning (BTL)" v={formatUsd(reasoning)} />
              <Line k="Tools (x402)" v={formatUsd(spentAtomic)} />
              <Line k="Saved by cache" v={formatUsd(live.savedCacheAtomic)} />
            </dl>
            <div className="mt-5 rounded-md border border-dashed border-[#2F6D4F]/40 bg-[#2F6D4F]/[0.06] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#2F6D4F]/80">Saved by memory</div>
              <div className="mt-1 font-mono-num text-2xl tabular text-[#2F6D4F]">{formatUsd(savedByMemory)}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#12131A]/55">
                Run twice: the second run avoids providers the first proved worthless.
              </p>
            </div>
          </Panel>

          {completedRuns.length >= 2 && <RunCompare />}
        </div>

        {/* CENTER — ledger */}
        <div>
          <Panel
            title="Decision ledger"
            right={
              <span className="flex items-center gap-2 font-mono-num text-[10px] uppercase tracking-[0.18em] text-[#12131A]/50">
                <CircleDot className="h-3 w-3 text-[#2F6D4F] anim-tick" />
                {mode} · base sepolia
              </span>
            }
          >
            {decisions.length === 0 ? (
              <EmptyLedger />
            ) : (
              <div className="divide-y divide-[#12131A]/10">
                {decisions.map((d) => (
                  <LedgerRow key={d.id} decision={d} />
                ))}
                {escalationId && <EscalationCard decisionId={escalationId} reason={escalationEntry?.[1]?.reason} />}
              </div>
            )}
          </Panel>

          {report && <FinalAnalysis report={report} />}
        </div>

        {/* RIGHT — memory + guardrails */}
        <div className="space-y-4">
          <Panel title="Provider memory" right={rankedProviders.length > 0 ? <Muted>{rankedProviders.length} known</Muted> : undefined}>
            {rankedProviders.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-[#12131A]/60">
                No memory yet. After a run, ThinkPay remembers which providers were cheap, fast, and accurate — and ranks
                them next time.
              </p>
            ) : (
              <div className="space-y-3">
                {rankedProviders.map((p) => (
                  <ProviderRow key={p.endpoint} p={p} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Guardrails">
            <ul className="space-y-2 text-[12.5px] text-[#12131A]/70">
              {["Hard budget cap", "Per-call escalation", "Duplicate detection", "No-progress streak", "Iteration backstop"].map(
                (g) => (
                  <li key={g} className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#2F6D4F]" />
                    {g}
                  </li>
                ),
              )}
            </ul>
          </Panel>
        </div>
      </main>
    </div>
  );
}

/* ── final analysis (the agent's actual answer) ──────────────────────── */
function FinalAnalysis({ report }: { report: string }) {
  return (
    <Panel title="Final analysis" right={<Muted>agent output</Muted>}>
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#B08D3F]" />
        <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#12131A]/85">{report}</p>
      </div>
    </Panel>
  );
}

/* ── nav ───────────────────────────────────────────────────────────── */
function AppNav({ phase }: { phase: Phase }) {
  const phases: Phase[] = ["Idle", "Planning", "Running", "Approval", "Done"];
  return (
    <header className="border-b border-[#12131A]/10 bg-[#F5F2EA]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#12131A]/15 text-[#12131A]/60 transition-colors hover:bg-[#12131A]/5 hover:text-[#12131A]"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#12131A]">
            <Scale className="h-4 w-4 text-[#B08D3F]" strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-serif-display text-lg leading-none">ThinkPay</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#12131A]/50">
              an AI research agent that knows when not to pay
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-[#12131A]/15 bg-white/60 p-1 font-mono-num text-[11px] uppercase tracking-[0.16em]">
          {phases.map((p) => (
            <span
              key={p}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                phase === p ? "bg-[#12131A] text-[#F5F2EA]" : "text-[#12131A]/50 hover:text-[#12131A]"
              }`}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ── panels + fields ───────────────────────────────────────────────── */
function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#12131A]/12 bg-white p-5 shadow-[0_1px_0_rgba(18,19,26,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#12131A]/55">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="font-mono-num text-[10px] uppercase tracking-[0.16em] text-[#12131A]/50">{children}</span>;
}

function ModeToggle({ mode, setMode, disabled }: { mode: "sim" | "live"; setMode: (m: "sim" | "live") => void; disabled?: boolean }) {
  return (
    <div className="flex overflow-hidden rounded-full border border-[#12131A]/15 font-mono-num text-[10px] uppercase tracking-[0.16em]">
      {(["sim", "live"] as const).map((m) => (
        <button
          key={m}
          onClick={() => !disabled && setMode(m)}
          disabled={disabled}
          className={`px-2.5 py-1 transition-colors disabled:opacity-50 ${
            mode === m ? "bg-[#12131A] text-[#F5F2EA]" : "text-[#12131A]/50 hover:text-[#12131A]"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#12131A]/55">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono-num text-[13px] text-[#12131A]/40">$</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-[#12131A]/15 bg-white py-2.5 pl-7 pr-3 text-right font-mono-num text-[15px] tabular outline-none focus:border-[#12131A]/60"
        />
      </div>
    </label>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[#12131A]/10">
      <div className="h-full bg-[#12131A] transition-[width] duration-700" style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#12131A]/8 pb-2 text-[#12131A]/70 last:border-0">
      <span>{k}</span>
      <span className="tabular text-[#12131A]">{v}</span>
    </div>
  );
}

function EmptyLedger() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#12131A]/15 bg-[#F5F2EA]">
        <Scale className="h-6 w-6 text-[#B08D3F]" strokeWidth={1.5} />
        <span className="absolute inset-0 rounded-full border border-dashed border-[#B08D3F]/40 anim-orbit-slow" />
      </div>
      <p className="max-w-xs text-[14px] leading-relaxed text-[#12131A]/60">
        Give the agent a task and a budget. Watch it decide what's worth paying for.
      </p>
    </div>
  );
}

/* ── ledger row (wired to a real Decision) ─────────────────────────── */
function LedgerRow({ decision }: { decision: Decision }) {
  const { kind, detail, amount } = rowFor(decision);
  const step = decision.capability ?? "reason";
  const tone =
    kind === "pay"
      ? "border-[#2F6D4F]/40 text-[#2F6D4F]"
      : kind === "dropped" || kind === "blocked"
      ? "border-[#9B4A38]/40 text-[#9B4A38]"
      : kind === "escalated"
      ? "border-[#B08D3F]/50 text-[#B08D3F]"
      : "border-[#2F6D4F]/30 text-[#2F6D4F]"; // saved
  const icon =
    step === "reason" ? (
      <Sparkles className="h-3.5 w-3.5" />
    ) : kind === "pay" || kind === "dropped" ? (
      <Cpu className="h-3.5 w-3.5" />
    ) : (
      <CircleDot className="h-3.5 w-3.5" />
    );
  return (
    <div className="anim-fade-up grid grid-cols-[110px_1fr_auto_auto] items-center gap-4 py-3">
      <div className="flex items-center gap-2 font-mono-num text-[11.5px] uppercase tracking-[0.14em] text-[#12131A]/55">
        {icon}
        {step}
      </div>
      <div className="text-[13.5px] text-[#12131A]/85">
        {detail}
        {decision.txHash && <span className="ml-2 font-mono-num text-[11px] text-[#12131A]/40">{shortHash(decision.txHash)}</span>}
      </div>
      <span className={`rounded-full border px-2 py-0.5 font-mono-num text-[10px] uppercase tracking-[0.14em] ${tone}`}>{kind}</span>
      <span className="w-20 text-right font-mono-num text-[13px] tabular text-[#12131A]">{amount}</span>
    </div>
  );
}

function shortHash(h: string): string {
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

/* ── escalation (real blocking approval, A/D shortcuts) ────────────── */
function EscalationCard({ decisionId, reason }: { decisionId: string; reason?: string }) {
  const decisions = useThinkPay((s) => s.decisions);
  const decision = decisions.find((d) => d.id === decisionId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "a" || e.key === "A") void respondEscalation(decisionId, true);
      if (e.key === "d" || e.key === "D") void respondEscalation(decisionId, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decisionId]);

  return (
    <div className="mt-4 flex items-center justify-between rounded-md border border-[#B08D3F]/40 bg-[#B08D3F]/[0.08] p-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#B08D3F]">Escalation</div>
        <div className="mt-1 text-[13px] text-[#12131A]/80">
          {decision?.capability ?? "Tool"} call is {formatUsd(decision?.estCostAtomic ?? 0)} — above your per-call limit.
        </div>
        {reason && <div className="mt-1 font-mono-num text-[11px] text-[#12131A]/50">{reason}</div>}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void respondEscalation(decisionId, true)}
          className="rounded-md bg-[#12131A] px-4 py-2 text-[12px] text-[#F5F2EA] hover:bg-black"
        >
          Approve <span className="ml-1 opacity-60">A</span>
        </button>
        <button
          onClick={() => void respondEscalation(decisionId, false)}
          className="rounded-md border border-[#12131A]/25 px-4 py-2 text-[12px] text-[#12131A]/70 hover:bg-[#12131A]/5"
        >
          Deny <span className="ml-1 opacity-60">D</span>
        </button>
      </div>
    </div>
  );
}

/* ── provider memory row (wired to a real ProviderStat) ────────────── */
function ProviderRow({ p }: { p: ProviderStat }) {
  const rejected = p.accuracyScore < REJECT_FLOOR;
  const best = !rejected && p.rank === 1;
  return (
    <div className={`rounded-md border p-3 ${rejected ? "border-[#9B4A38]/30 bg-[#9B4A38]/5" : best ? "border-[#2F6D4F]/30 bg-[#2F6D4F]/5" : "border-[#12131A]/12"}`}>
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium">{p.name}</div>
        <span className="font-mono-num text-[10px] uppercase tracking-[0.16em] text-[#12131A]/50">{p.capability}</span>
      </div>
      <div className="mt-2 flex items-center justify-between font-mono-num text-[11.5px]">
        <span className={rejected ? "text-[#9B4A38]" : "text-[#2F6D4F]"}>acc {p.accuracyScore.toFixed(2)}</span>
        <span className="tabular text-[#12131A]/70">
          {(p.avgLatencyMs / 1000).toFixed(1)}s · {formatUsd(p.avgCostAtomic)} · {p.timesUsed}×
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#12131A]/10">
        <div className={`h-full ${rejected ? "bg-[#9B4A38]" : "bg-[#2F6D4F]"}`} style={{ width: `${p.accuracyScore * 100}%` }} />
      </div>
    </div>
  );
}

/* ── cold vs warm (appears after the 2nd run) ──────────────────────── */
function RunCompare() {
  const runs = useThinkPay((s) => s.completedRuns);
  if (runs.length < 2) return null;
  const cold = runs[0];
  const warm = runs[runs.length - 1];
  if (!cold || !warm) return null;

  const coldTotal = cold.totals.toolAtomic;
  const warmTotal = warm.totals.toolAtomic;
  const max = Math.max(coldTotal, warmTotal, 1);
  const deltaPct = coldTotal > 0 ? Math.round(((coldTotal - warmTotal) / coldTotal) * 100) : 0;

  const Bar = ({ label, atomic, warmTone }: { label: string; atomic: number; warmTone?: boolean }) => (
    <div className="flex items-center gap-2.5">
      <span className={`w-9 font-mono-num text-[10px] uppercase tracking-[0.14em] ${warmTone ? "text-[#B08D3F]" : "text-[#12131A]/45"}`}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#12131A]/10">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${warmTone ? "bg-[#B08D3F]" : "bg-[#12131A]/40"}`}
          style={{ width: `${(atomic / max) * 100}%` }}
        />
      </div>
      <span className={`w-[52px] text-right font-mono-num text-[11px] tabular ${warmTone ? "text-[#B08D3F]" : "text-[#12131A]/70"}`}>{formatUsd(atomic)}</span>
    </div>
  );

  return (
    <Panel title="Cold vs warm" right={<span className="font-mono-num text-[13px] font-medium text-[#2F6D4F]">−{deltaPct}% spend</span>}>
      <div className="space-y-2.5">
        <Bar label="cold" atomic={coldTotal} />
        <Bar label="warm" atomic={warmTotal} warmTone />
      </div>
    </Panel>
  );
}
