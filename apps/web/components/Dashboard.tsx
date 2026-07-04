"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useMizan } from "@/lib/store";
import { useProvidersOnMount } from "@/lib/useRunStream";
import { SPRING, DUR } from "@/lib/motion";
import RunControls from "./RunControls";
import SpendMeter from "./SpendMeter";
import LedgerFeed from "./LedgerFeed";
import ProviderTable from "./ProviderTable";
import EscalationChip from "./EscalationChip";
import RunCompare from "./RunCompare";

/* ── header status stepper ─────────────────────────────────────────── */
const STEPS = ["idle", "planning", "running", "approval", "done"] as const;
const STEP_OF: Record<string, (typeof STEPS)[number]> = {
  idle: "idle",
  planning: "planning",
  running: "running",
  awaiting_approval: "approval",
  done: "done",
  error: "idle",
};

function StatusStepper() {
  const runStatus = useMizan((s) => s.runStatus);
  const error = useMizan((s) => s.error);
  const active = STEP_OF[runStatus] ?? "idle";

  if (runStatus === "error") {
    return (
      <div className="flex items-center gap-2 rounded-chip border border-[color:var(--color-bad)]/40 bg-[color:var(--color-bad)]/10 px-3 py-1" role="status">
        <span className="h-1.5 w-1.5 rounded-full bg-bad-bright" />
        <span className="font-mono text-[11px] text-bad-bright">{error ?? "error"}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-chip border border-line bg-surface/60 p-1 backdrop-blur-sm">
      {STEPS.map((s) => {
        const on = s === active;
        return (
          <span key={s} className="relative rounded-chip px-2.5 py-1 font-sans text-[10.5px] font-medium tracking-[0.04em]">
            {on && (
              <motion.span
                layoutId="status-pill"
                className="absolute inset-0 rounded-chip bg-surface-3"
                transition={SPRING.reorder}
              />
            )}
            <span className={`relative capitalize ${on ? "text-t-hi" : "text-t-low"}`}>{s}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ── column entrance ───────────────────────────────────────────────── */
function Col({ children, delay, className }: { children: React.ReactNode; delay: number; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: DUR.fade } : { ...SPRING.panel, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function Dashboard() {
  useProvidersOnMount();
  const reduced = useReducedMotion() ?? false;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="app-bg" aria-hidden />
      <div className="app-grain" aria-hidden />

      <div className="relative z-10 flex h-full flex-col px-6 pb-6 pt-5">
        {/* header */}
        <motion.header
          className="flex h-14 shrink-0 items-center justify-between"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: DUR.fade } : SPRING.panel}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line-2 bg-surface-2 shadow-[var(--shadow-card)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-brass-bright)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 4.5v15" />
                <path d="M6 8.2h12" />
                <path d="M4.2 20h15.6" opacity="0.5" />
                <path d="M6 8.2 3.3 14a2.7 2.7 0 0 0 5.4 0L6 8.2Z" />
                <path d="M18 8.2 15.3 14a2.7 2.7 0 0 0 5.4 0L18 8.2Z" />
              </svg>
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-sans text-[15px] font-bold tracking-[-0.01em] text-t-hi">Mizan</span>
              <span className="mt-1 font-sans text-[11px] text-t-low">a spending conscience for agents</span>
            </div>
          </div>
          <StatusStepper />
        </motion.header>

        {/* body — 3 balanced columns, no empty space */}
        <div className="mt-5 grid min-h-0 flex-1 gap-5" style={{ gridTemplateColumns: "360px minmax(0, 1fr) 340px" }}>
          {/* left — configure + spend */}
          <Col delay={0.05} className="flex min-h-0 flex-col gap-5">
            <RunControls />
            <div className="min-h-0 flex-1">
              <SpendMeter />
            </div>
          </Col>

          {/* center — the ledger (the star) */}
          <Col delay={0.12} className="relative min-h-0">
            <LedgerFeed />
            <EscalationChip />
          </Col>

          {/* right — provider memory + compare */}
          <Col delay={0.19} className="flex min-h-0 flex-col gap-5">
            <div className="min-h-0 flex-1">
              <ProviderTable />
            </div>
            {mounted && <RunCompare />}
          </Col>
        </div>
      </div>
    </main>
  );
}
