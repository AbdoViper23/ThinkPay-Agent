"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { formatUsd } from "@thinkpay/shared";
import { useThinkPay } from "@/lib/store";
import { SPRING, TIMING } from "@/lib/motion";
import AnimatedUsd from "./AnimatedUsd";

/**
 * Hero KPI. The bar measures TOOL (x402) spend vs budget — exactly what the
 * guardrails cap. Reasoning (BTL) is shown as a second figure, never inside
 * the bar (it can't trip the cap). "Saved by memory" is the emotional payoff.
 */
export default function SpendMeter() {
  const decisions = useThinkPay((s) => s.decisions);
  const live = useThinkPay((s) => s.live);
  const totals = useThinkPay((s) => s.totals);
  const budgetAtomic = useThinkPay((s) => s.budgetAtomic);
  const runStatus = useThinkPay((s) => s.runStatus);
  const completedRuns = useThinkPay((s) => s.completedRuns);
  const reduced = useReducedMotion() ?? false;

  const idle = runStatus === "idle" && decisions.length === 0;
  const paid = decisions.filter((d) => d.paidCostAtomic != null && d.paidCostAtomic > 0);
  const [hovered, setHovered] = useState<string | null>(null);

  const pct = budgetAtomic > 0 ? Math.min(100, Math.round((live.spentToolAtomic / budgetAtomic) * 100)) : 0;
  const savedByMemory = totals?.savedByMemoryAtomic ?? 0;
  const isWarmDone = runStatus === "done" && completedRuns.length >= 2 && savedByMemory > 0;

  const Row = ({ label, value, tone = "mid" }: { label: string; value: string; tone?: "mid" | "ok" | "low" }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="font-sans text-[12px] text-t-low">{label}</span>
      <span className={`font-mono text-[13px] ${tone === "ok" ? "text-ok-bright" : tone === "low" ? "text-t-low" : "text-t-mid"}`}>
        {value}
      </span>
    </div>
  );

  return (
    <section className="card flex h-full flex-col p-5" aria-label="Spend">
      <div className="flex items-center justify-between">
        <h2 className="card-label">Tool spend</h2>
        <span className="font-mono text-[11px] text-t-low">{idle ? "—" : `${pct}% of budget`}</span>
      </div>

      {/* hero figure */}
      <div className="mt-3 flex items-baseline gap-2">
        <AnimatedUsd atomic={live.spentToolAtomic} unlit={idle} className="text-[40px] font-medium leading-none text-t-hi" />
        <span className="font-mono text-[13px] text-t-low">/ {idle ? "$0.000" : formatUsd(budgetAtomic)}</span>
      </div>

      {/* the bar — one brass segment per paid decision, hover to inspect */}
      <div
        className="relative mt-4 h-2.5 overflow-hidden rounded-chip bg-bg-2"
        role="img"
        aria-label={`tool spend ${formatUsd(live.spentToolAtomic)} of ${formatUsd(budgetAtomic)}`}
      >
        <div className="absolute inset-0 flex items-stretch gap-px">
          {budgetAtomic > 0 &&
            paid.map((d) => (
              <motion.div
                key={d.id}
                className="h-full first:rounded-l-chip"
                style={{ background: hovered === d.id ? "var(--color-brass-bright)" : "var(--color-brass)" }}
                initial={{ width: 0 }}
                animate={{ width: `${((d.paidCostAtomic ?? 0) / budgetAtomic) * 100}%` }}
                transition={reduced ? { duration: 0.15 } : { ...SPRING.meter, delay: TIMING.row.meter }}
                onMouseEnter={() => setHovered(d.id)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
        </div>
      </div>
      <div className="mt-1.5 h-4">
        <AnimatePresence>
          {hovered &&
            (() => {
              const d = paid.find((x) => x.id === hovered);
              if (!d) return null;
              return (
                <motion.div
                  key="tip"
                  className="font-mono text-[10.5px] text-t-mid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {d.capability} → {d.providerName ?? "?"} · {formatUsd(d.paidCostAtomic ?? 0)}
                </motion.div>
              );
            })()}
        </AnimatePresence>
      </div>

      {/* dual ledger */}
      <div className="mt-3 divide-y divide-[color:var(--color-line)] border-t border-line">
        <Row label="Reasoning (BTL)" value={totals ? formatUsd(totals.reasoningMicros) : idle ? "$0.000" : "…"} />
        <Row label="Tools (x402)" value={idle ? "$0.000" : formatUsd(live.spentToolAtomic)} />
        <Row label="Saved by cache" value={idle ? "—" : formatUsd(live.savedCacheAtomic)} tone={live.savedCacheAtomic > 0 ? "ok" : "low"} />
      </div>

      {/* saved by memory — the payoff */}
      <div className="mt-auto rounded-ctl border border-line bg-bg-2 p-3.5">
        <div className="flex items-center gap-1.5">
          <span className="card-label">Saved by memory</span>
        </div>
        <motion.div
          className="mt-1.5"
          initial={false}
          animate={{ color: isWarmDone ? "var(--color-brass-bright)" : "var(--color-t-mid)" }}
          transition={{ duration: reduced ? 0.15 : 0.9, delay: reduced ? 0 : TIMING.done.saved }}
        >
          <AnimatedUsd atomic={savedByMemory} unlit={idle} className="text-[26px] font-medium leading-none" />
        </motion.div>
        <p className="mt-1.5 font-sans text-[11px] leading-snug text-t-low">
          {isWarmDone
            ? "The warm run reused what memory learned — fewer paid calls, lower spend."
            : "Run twice: the second run avoids providers the first proved worthless."}
        </p>
      </div>
    </section>
  );
}
