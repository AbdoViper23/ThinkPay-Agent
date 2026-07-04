"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatUsd } from "@thinkpay/shared";
import { useThinkPay } from "@/lib/store";
import { TIMING } from "@/lib/motion";

/** Cold vs warm — the warm bar visibly stops short. Appears after the 2nd run. */
export default function RunCompare() {
  const runs = useThinkPay((s) => s.completedRuns);
  const reduced = useReducedMotion() ?? false;
  if (runs.length < 2) return null;

  const cold = runs[0];
  const warm = runs[runs.length - 1];
  if (!cold || !warm) return null;

  const coldTotal = cold.totals.toolAtomic;
  const warmTotal = warm.totals.toolAtomic;
  const max = Math.max(coldTotal, warmTotal, 1);
  const deltaPct = coldTotal > 0 ? Math.round(((coldTotal - warmTotal) / coldTotal) * 100) : 0;

  const Bar = ({ label, atomic, tone, delay }: { label: string; atomic: number; tone: "cold" | "warm"; delay: number }) => (
    <div className="flex items-center gap-2.5">
      <span className={`w-9 font-mono text-[10px] ${tone === "warm" ? "text-brass-bright" : "text-t-low"}`}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-chip bg-bg-2">
        <motion.div
          className={`h-full rounded-chip ${tone === "warm" ? "bg-brass" : "bg-t-faint"}`}
          style={{ originX: 0 }}
          initial={reduced ? { width: `${(atomic / max) * 100}%` } : { scaleX: 0, width: `${(atomic / max) * 100}%` }}
          animate={reduced ? {} : { scaleX: 1 }}
          transition={reduced ? { duration: 0 } : { duration: tone === "warm" ? 0.5 : 0.3, delay, ease: [0.1, 0.9, 0.15, 1] }}
        />
      </div>
      <span className={`w-[52px] text-right font-mono text-[11px] ${tone === "warm" ? "text-brass-bright" : "text-t-mid"}`}>
        {formatUsd(atomic)}
      </span>
    </div>
  );

  return (
    <motion.section
      className="card shrink-0 p-4"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 300, damping: 30 }}
      aria-label="Cold vs warm comparison"
    >
      <div className="flex items-center justify-between">
        <h2 className="card-label">Cold vs warm</h2>
        <motion.span
          className="font-mono text-[13px] font-medium text-ok-bright"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : TIMING.compare.delta, duration: 0.3 }}
        >
          −{deltaPct}% spend
        </motion.span>
      </div>
      <div className="mt-3 space-y-2.5">
        <Bar label="cold" atomic={coldTotal} tone="cold" delay={reduced ? 0 : TIMING.compare.cold} />
        <Bar label="warm" atomic={warmTotal} tone="warm" delay={reduced ? 0 : TIMING.compare.warm} />
      </div>
    </motion.section>
  );
}
