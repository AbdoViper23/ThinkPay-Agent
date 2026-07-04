"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatUsd } from "@thinkpay/shared";
import { useThinkPay } from "@/lib/store";
import { respondEscalation } from "@/lib/runController";
import { SPRING, DUR } from "@/lib/motion";

/**
 * Approval, focused: a card centered over the ledger with a scrim. The agent
 * proposed a call over the per-call limit; the human decides. A / D shortcuts.
 */
export default function EscalationChip() {
  const pending = useThinkPay((s) => s.pendingEscalations);
  const decisions = useThinkPay((s) => s.decisions);
  const reduced = useReducedMotion() ?? false;
  const approveRef = useRef<HTMLButtonElement>(null);

  const entry = Object.entries(pending)[0];
  const decisionId = entry?.[0];
  const reason = entry?.[1]?.reason;
  const decision = decisionId ? decisions.find((d) => d.id === decisionId) : undefined;

  useEffect(() => {
    if (!decisionId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "a" || e.key === "A") void respondEscalation(decisionId, true);
      if (e.key === "d" || e.key === "D") void respondEscalation(decisionId, false);
    };
    window.addEventListener("keydown", onKey);
    approveRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [decisionId]);

  return (
    <AnimatePresence>
      {decisionId && (
        <motion.div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-card p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: DUR.chipExit } }}
        >
          {/* scrim over the ledger only */}
          <div className="absolute inset-0 rounded-card bg-bg/70 backdrop-blur-[2px]" aria-hidden />

          <motion.div
            role="alertdialog"
            aria-label="Payment approval required"
            className="relative w-[320px] overflow-hidden rounded-card border border-brass-dim bg-surface-2 shadow-[var(--shadow-pop)]"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: DUR.chipExit } }}
            transition={reduced ? { duration: DUR.fade } : SPRING.stamp}
          >
            {/* brass top edge — pulses only when motion is allowed */}
            <motion.div
              className="h-[3px] w-full bg-brass"
              animate={reduced ? { opacity: 1 } : { opacity: [1, 0.4, 1] }}
              transition={reduced ? { duration: 0 } : { duration: 1.4, repeat: Infinity }}
              aria-hidden
            />
            <div className="p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brass/15 text-brass-bright">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M8 3v6" />
                    <circle cx="8" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span className="card-label !text-brass-bright">Approval needed</span>
              </div>

              <p className="mt-3 font-sans text-[13px] leading-snug text-t-hi">
                The agent wants to pay{" "}
                <span className="font-mono font-medium text-brass-bright">{formatUsd(decision?.estCostAtomic ?? 0)}</span> for the{" "}
                <span className="text-t-hi">{decision?.capability ?? "tool"}</span> call.
              </p>
              <p className="mt-1 font-mono text-[11px] text-t-mid">{reason}</p>

              <div className="mt-4 flex gap-2">
                <button
                  ref={approveRef}
                  onClick={() => void respondEscalation(decisionId, true)}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-ctl bg-ok font-sans text-[12.5px] font-semibold text-[#0c1a12] transition-colors hover:bg-ok-bright"
                >
                  <span className="keycap !border-black/20 !bg-black/10 !text-[#0c1a12]">A</span> Approve
                </button>
                <button
                  onClick={() => void respondEscalation(decisionId, false)}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-ctl border border-line-2 font-sans text-[12.5px] font-semibold text-bad-bright transition-colors hover:bg-bad hover:text-t-hi"
                >
                  <span className="keycap">D</span> Deny
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
