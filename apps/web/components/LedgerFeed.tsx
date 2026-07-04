"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatUsd } from "@thinkpay/shared";
import { useThinkPay } from "@/lib/store";
import { SPRING, TIMING } from "@/lib/motion";
import LedgerRow from "./LedgerRow";
import { TypeLine, Stamp } from "./primitives";

export default function LedgerFeed() {
  const decisions = useThinkPay((s) => s.decisions);
  const statusNote = useThinkPay((s) => s.statusNote);
  const runStatus = useThinkPay((s) => s.runStatus);
  const totals = useThinkPay((s) => s.totals);
  const reduced = useReducedMotion() ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [decisions.length, totals, reduced]);

  const now = Date.now();
  const isInstant = (createdAt: number) => now - createdAt > 2000;
  const idle = runStatus === "idle" && decisions.length === 0;
  const live = runStatus === "planning" || runStatus === "running" || runStatus === "awaiting_approval";

  return (
    <section className="card flex h-full flex-col overflow-hidden" aria-label="Decision ledger">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
        <div className="flex items-center gap-2.5">
          <h2 className="card-label !text-[11px] !text-t-mid">Decision ledger</h2>
          {live && (
            <span className="flex items-center gap-1.5 rounded-chip bg-surface-3 px-2 py-0.5">
              <span className={`h-1.5 w-1.5 rounded-full bg-brass ${reduced ? "" : "animate-pulse"}`} />
              <span className="font-mono text-[10px] text-t-mid">{statusNote ?? "working"}</span>
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-t-low">
          {decisions.length > 0 ? `${decisions.length} ${decisions.length === 1 ? "entry" : "entries"}` : ""}
        </span>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {idle ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-line-2 bg-surface-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-brass)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 4.5v15" />
                <path d="M6 8.2h12" />
                <path d="M6 8.2 3.3 14a2.7 2.7 0 0 0 5.4 0L6 8.2Z" />
                <path d="M18 8.2 15.3 14a2.7 2.7 0 0 0 5.4 0L18 8.2Z" />
              </svg>
            </span>
            <p className="max-w-[300px] font-sans text-[14px] leading-relaxed text-t-mid">
              <TypeLine text="Give the agent a task and a budget. Watch it decide what's worth paying for." startDelay={TIMING.load.invite} />
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {decisions.map((d) => (
              <LedgerRow key={d.id} decision={d} instant={isInstant(d.createdAt)} />
            ))}
          </AnimatePresence>
        )}

        {runStatus === "done" && totals && (
          <motion.footer
            className="mx-2 mb-1 mt-3 rounded-ctl border border-line bg-bg-2 p-4"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0.15 } : { ...SPRING.panel, delay: TIMING.done.settle }}
          >
            <div className="flex items-center justify-between">
              <span className="card-label">Run complete</span>
              <Stamp tone="brass" delay={reduced ? 0 : TIMING.done.seal}>
                <span className="inline-block rounded border border-brass-dim px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-brass-bright">
                  Balanced
                </span>
              </Stamp>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { k: "Total", v: formatUsd(totals.toolAtomic + totals.reasoningMicros) },
                { k: "Paid calls", v: String(totals.calls) },
                { k: "Rejected", v: String(totals.rejections) },
              ].map((s) => (
                <div key={s.k}>
                  <div className="card-label !text-[9.5px]">{s.k}</div>
                  <div className="mt-1 font-mono text-[15px] text-t-hi">{s.v}</div>
                </div>
              ))}
            </div>
          </motion.footer>
        )}
      </div>
    </section>
  );
}
