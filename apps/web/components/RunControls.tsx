"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DEMO_TASK, DEMO_BUDGET_USD, DEMO_PER_CALL_USD } from "@mizan/shared";
import { useMizan } from "@/lib/store";
import { startRun } from "@/lib/runController";
import { useRunElapsed } from "@/lib/useRunStream";
import AnimatedUsd from "./AnimatedUsd";

export default function RunControls() {
  const reduced = useReducedMotion() ?? false;
  const mode = useMizan((s) => s.mode);
  const setMode = useMizan((s) => s.setMode);
  const runStatus = useMizan((s) => s.runStatus);
  const runCount = useMizan((s) => s.runCount);
  const spent = useMizan((s) => s.live.spentToolAtomic);
  const elapsed = useRunElapsed();

  const [task, setTask] = useState(DEMO_TASK);
  const [budget, setBudget] = useState(DEMO_BUDGET_USD.toFixed(2));
  const [perCall, setPerCall] = useState(DEMO_PER_CALL_USD.toFixed(2));

  const running = runStatus === "planning" || runStatus === "running" || runStatus === "awaiting_approval";
  const warmNext = mode === "sim" && runCount >= 1 && !running;

  const run = () => {
    const budgetUsd = Number.parseFloat(budget);
    const perCallLimitUsd = Number.parseFloat(perCall);
    if (!task.trim() || !Number.isFinite(budgetUsd) || !Number.isFinite(perCallLimitUsd)) return;
    void startRun({ task: task.trim(), budgetUsd, perCallLimitUsd });
  };

  return (
    <section className="card p-4" aria-label="Configure run">
      <div className="flex items-center justify-between">
        <h2 className="card-label">New run</h2>
        {/* sim / live segmented toggle */}
        <div className="flex items-center rounded-chip border border-line bg-bg-2 p-0.5">
          {(["sim", "live"] as const).map((m) => (
            <button
              key={m}
              onClick={() => !running && setMode(m)}
              disabled={running}
              className={`relative rounded-chip px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors ${
                mode === m ? "text-t-hi" : "text-t-low hover:text-t-mid"
              }`}
              title={m === "sim" ? "Scripted demo — no backend needed" : "Live — talks to the agent on :3001"}
            >
              {mode === m && (
                <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-chip bg-surface-3" transition={SPRING_REORDER} />
              )}
              <span className="relative">{m}</span>
            </button>
          ))}
        </div>
      </div>

      <label htmlFor="task" className="mt-3.5 block">
        <span className="sr-only">Task</span>
        <textarea
          id="task"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={running}
          rows={3}
          placeholder="What should the agent find out?"
          className="field resize-none px-3 py-2.5 font-sans text-[13px] leading-[1.5] disabled:opacity-60"
          style={{ height: "auto" }}
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="card-label mb-1.5 block">Budget</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-t-low">$</span>
            <input
              aria-label="budget in dollars"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              disabled={running}
              inputMode="decimal"
              className="field pl-6 pr-3 text-right font-mono text-[13px] disabled:opacity-60"
            />
          </div>
        </label>
        <label className="block">
          <span className="card-label mb-1.5 block">Per-call limit</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-t-low">$</span>
            <input
              aria-label="per-call limit in dollars"
              value={perCall}
              onChange={(e) => setPerCall(e.target.value)}
              disabled={running}
              inputMode="decimal"
              className="field pl-6 pr-3 text-right font-mono text-[13px] disabled:opacity-60"
            />
          </div>
        </label>
      </div>

      <button
        onClick={run}
        disabled={running}
        className={`group mt-3.5 flex h-11 w-full items-center justify-center gap-2 rounded-ctl font-sans text-[13px] font-semibold tracking-[0.01em] transition-all ${
          running
            ? "cursor-default border border-line bg-surface-3 text-brass-bright"
            : "bg-brass text-[#20180a] hover:bg-brass-bright active:scale-[0.985]"
        }`}
      >
        {running ? (
          <span className="flex items-center gap-2 font-mono text-[12px]">
            <span className={reduced ? "" : "animate-pulse"} aria-hidden>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brass-bright" />
            </span>
            <AnimatedUsd atomic={spent} className="text-[12px] text-brass-bright" />
            {elapsed != null && <span className="text-t-mid">· {(elapsed / 1000).toFixed(1)}s</span>}
          </span>
        ) : (
          <>
            <PlayIcon />
            {warmNext ? "Run again" : "Run agent"}
          </>
        )}
      </button>

      {warmNext && (
        <p className="mt-2.5 flex items-center gap-1.5 font-sans text-[11px] text-t-low">
          <span className="h-1 w-1 rounded-full bg-brass" />
          Memory is warm — this run should skip the provider it learned to avoid.
        </p>
      )}
    </section>
  );
}

const SPRING_REORDER = { type: "spring", stiffness: 350, damping: 32 } as const;

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4.5 3.2c0-.5.55-.8.98-.54l7.2 4.8a.65.65 0 0 1 0 1.08l-7.2 4.8a.65.65 0 0 1-.98-.54V3.2Z" />
    </svg>
  );
}
