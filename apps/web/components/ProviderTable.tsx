"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatUsd } from "@thinkpay/shared";
import { useThinkPay } from "@/lib/store";
import { SPRING } from "@/lib/motion";

const REJECT_FLOOR = 0.25;

/** Provider memory — why the warm run skips the bad provider. Rows FLIP-reorder on refetch. */
export default function ProviderTable() {
  const providers = useThinkPay((s) => s.providers);
  const reduced = useReducedMotion() ?? false;

  const sorted = [...providers].sort((a, b) => {
    const aBad = a.accuracyScore < REJECT_FLOOR ? 1 : 0;
    const bBad = b.accuracyScore < REJECT_FLOOR ? 1 : 0;
    if (aBad !== bBad) return aBad - bBad;
    return (b.score ?? b.accuracyScore) - (a.score ?? a.accuracyScore);
  });

  return (
    <section className="card flex h-full flex-col overflow-hidden" aria-label="Provider memory">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
        <h2 className="card-label !text-[11px] !text-t-mid">Provider memory</h2>
        {sorted.length > 0 && <span className="font-mono text-[11px] text-t-low">{sorted.length} known</span>}
      </header>

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center px-5">
          <p className="font-sans text-[13px] leading-relaxed text-t-low">
            No memory yet. After a run, ThinkPay remembers which providers were cheap, fast, and accurate — and ranks them next time.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <div className="grid grid-cols-[18px_1fr_42px_50px_34px_28px] gap-1.5 px-3 pb-2 pt-1">
            <span className="card-label !text-[9.5px] text-right">#</span>
            <span className="card-label !text-[9.5px]">Provider</span>
            <span className="card-label !text-[9.5px] text-right">Lat</span>
            <span className="card-label !text-[9.5px] text-right">Cost</span>
            <span className="card-label !text-[9.5px] text-right">Acc</span>
            <span className="card-label !text-[9.5px] text-right">Use</span>
          </div>
          {sorted.map((p) => {
            const bad = p.accuracyScore < REJECT_FLOOR;
            return (
              <motion.div
                key={p.endpoint}
                layout={!reduced}
                transition={SPRING.reorder}
                className={`relative grid grid-cols-[18px_1fr_42px_50px_34px_28px] items-center gap-1.5 rounded-row px-3 py-2.5 ${
                  bad ? "opacity-65" : ""
                }`}
              >
                <span
                  className={`text-right font-mono text-[12px] tabular-nums ${
                    bad ? "text-bad-bright" : p.rank === 1 ? "text-brass" : "text-t-low"
                  }`}
                >
                  {p.rank ?? "—"}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate font-sans text-[12.5px] ${bad ? "text-t-mid" : "text-t-hi"}`}>{p.name}</span>
                  <span className="block truncate font-mono text-[10px] text-t-low">
                    {p.capability}{bad ? " · avoid" : p.rank === 1 ? " · best" : ""}
                  </span>
                </span>
                <span className="text-right font-mono text-[11px] text-t-mid tabular-nums">{(p.avgLatencyMs / 1000).toFixed(1)}s</span>
                <span className="text-right font-mono text-[11px] text-t-mid tabular-nums">{formatUsd(p.avgCostAtomic)}</span>
                <span className={`text-right font-mono text-[11px] tabular-nums ${bad ? "text-bad-bright" : "text-ok-bright"}`}>
                  {p.accuracyScore.toFixed(2)}
                </span>
                <span className="text-right font-mono text-[11px] text-t-low tabular-nums">{p.timesUsed}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
