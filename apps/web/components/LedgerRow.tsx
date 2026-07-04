"use client";

import { Fragment, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Decision } from "@thinkpay/shared";
import { formatUsd } from "@thinkpay/shared";
import { SPRING, TIMING, DUR } from "@/lib/motion";
import { useThinkPay } from "@/lib/store";
import { Stamp, HashResolve, MarkIcon, type MarkKind } from "./primitives";

type Tone = "ok" | "bad" | "brass" | "mid";
function verdictOf(d: Decision): { tone: Tone; mark: MarkKind; label: string } {
  if (d.guardrail === "pending") return { tone: "brass", mark: "pending", label: "Awaiting approval" };
  if (d.guardrail === "block") return { tone: "bad", mark: "block", label: d.guardrailReason ?? "Blocked" };
  if (d.guardrail === "use_cache") return { tone: "ok", mark: "cache", label: "From memory" };
  if (d.verifyOk === false) return { tone: "bad", mark: "cross", label: "Rejected" };
  if (d.verifyOk === true) return { tone: "ok", mark: "check", label: "Verified" };
  return { tone: "mid", mark: "dot", label: "Paying…" };
}

const TONE_TEXT: Record<Tone, string> = { ok: "text-ok-bright", bad: "text-bad-bright", brass: "text-brass-bright", mid: "text-t-mid" };
const TONE_RULE: Record<Tone, string> = {
  ok: "var(--color-ok)",
  bad: "var(--color-bad)",
  brass: "var(--color-brass)",
  mid: "var(--color-t-faint)",
};

export default function LedgerRow({ decision: d, instant }: { decision: Decision; instant: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const skip = instant || reduced;
  const runStartedAt = useThinkPay((s) => s.runStartedAt);
  const hasPending = useThinkPay((s) => Object.keys(s.pendingEscalations).length > 0);
  const [open, setOpen] = useState(false);

  const v = verdictOf(d);
  const struck = d.verifyOk === false;
  const pending = d.guardrail === "pending";
  const cache = d.guardrail === "use_cache";
  const amount = d.paidCostAtomic ?? (cache ? 0 : d.estCostAtomic);
  const dimmed = hasPending && !pending;
  const rel = runStartedAt ? `+${((d.createdAt - runStartedAt) / 1000).toFixed(1)}s` : "";

  return (
    <motion.div
      layout={!skip}
      initial={skip ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: dimmed ? 0.4 : 1 }}
      exit={{ height: 0, opacity: 0, transition: { duration: DUR.rowExit } }}
      transition={skip ? { duration: 0 } : SPRING.row}
      className="overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="group/row relative flex w-full items-center gap-3 rounded-row px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
        aria-expanded={open}
      >
        {/* verdict rail */}
        <motion.span
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
          style={{ background: TONE_RULE[v.tone], originY: 0 }}
          initial={skip ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={skip ? { duration: 0 } : { duration: 0.18, delay: TIMING.row.rule, ease: [0.22, 0.61, 0.24, 1] }}
          aria-hidden
        />

        {/* mark */}
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 ${TONE_TEXT[v.tone]}`}>
          {pending ? (
            <motion.span animate={reduced ? {} : { opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} aria-hidden>
              <MarkIcon kind="pending" size={13} />
            </motion.span>
          ) : (
            <Stamp tone={v.tone} delay={skip ? 0 : TIMING.row.stamp}>
              <MarkIcon kind={v.mark} size={13} />
            </Stamp>
          )}
        </span>

        {/* narrative */}
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-sans text-[13px] leading-tight text-t-hi ${struck ? "struck !text-t-mid" : ""}`}>
            {d.subGoal}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-t-low">
            {d.providerName ? <span className="truncate">{d.providerName}</span> : <span>{v.label.toLowerCase()}</span>}
            {rel && <span className="text-t-faint">· {rel}</span>}
          </span>
        </span>

        {/* amount */}
        <span className="shrink-0 text-right">
          {cache && d.savedAtomic > 0 ? (
            <span className="font-mono text-[12px] text-ok-bright">−{formatUsd(d.savedAtomic)}</span>
          ) : amount > 0 ? (
            <span className={`font-mono text-[13px] ${struck ? "struck text-t-mid" : "text-t-hi"}`}>{formatUsd(amount)}</span>
          ) : (
            <span className="font-mono text-[13px] text-t-low">—</span>
          )}
          <span className={`mt-0.5 block font-sans text-[10px] ${TONE_TEXT[v.tone]}`}>{v.label}</span>
        </span>

        {/* chevron */}
        <motion.span className="shrink-0 text-t-faint" animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </motion.span>
      </button>

      {/* rejected reason line */}
      {struck && d.verifyReason && !open && (
        <div className="px-3 pb-2 pl-12 font-mono text-[11px] italic text-bad-bright/80">{d.verifyReason}</div>
      )}

      {/* audit trace */}
      {open && (
        <div className="mx-3 mb-2 rounded-ctl border border-line bg-bg-2 px-3.5 py-3 font-mono text-[11px] leading-relaxed">
          <div className="grid grid-cols-[86px_1fr] gap-y-1.5">
            {(
              [
                ["guardrail", `${d.guardrail}${d.guardrailReason ? ` — ${d.guardrailReason}` : ""}`],
                ["verify", d.verifyOk == null ? "—" : `${d.verifyOk ? "yes" : "no"}${d.verifyReason ? ` — ${d.verifyReason}` : ""}`],
                ["est / paid", `${formatUsd(d.estCostAtomic)} / ${d.paidCostAtomic != null ? formatUsd(d.paidCostAtomic) : "—"}`],
                ["endpoint", d.provider ?? "—"],
              ] as const
            ).map(([k, val]) => (
              <Fragment key={k}>
                <span className="text-t-low">{k}</span>
                <span className="truncate text-t-mid">{val}</span>
              </Fragment>
            ))}
            {d.txHash && (
              <>
                <span className="text-t-low">settlement</span>
                <span>
                  <HashResolve hash={d.txHash} />
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
