"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatUsd } from "@thinkpay/shared";
import { SPRING } from "@/lib/motion";

/**
 * Money display: atomic int in → slot-rolling tabular digits out.
 * The ONLY place money becomes a string.
 *
 * Baseline-correct: an invisible static digit sits in-flow to carry width AND
 * the text baseline; the rolling column is an absolute overlay clipped to it.
 * (A bare overflow-hidden inline-block baselines at its bottom edge and floats
 * the digits above the '$' and '.', per CSS 2.1 §10.8.1 — this avoids that.)
 */
function DigitColumn({ digit, instant }: { digit: number; instant: boolean }) {
  return (
    <span className="relative inline-block leading-none" style={{ verticalAlign: "baseline" }}>
      <span className="invisible" aria-hidden>
        {digit}
      </span>
      <span className="absolute inset-0 overflow-hidden">
        <motion.span
          className="flex flex-col leading-none"
          animate={{ y: `${-digit * 10}%` }}
          transition={instant ? { duration: 0 } : SPRING.row}
        >
          {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c) => (
            <span key={c} className="h-[1em] leading-none">
              {c}
            </span>
          ))}
        </motion.span>
      </span>
    </span>
  );
}

export default function AnimatedUsd({
  atomic,
  className,
  unlit = false,
}: {
  atomic: number;
  className?: string;
  unlit?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const text = formatUsd(atomic);

  if (unlit) {
    return (
      <span className={`font-mono ${className ?? ""}`} aria-label="no spend yet">
        $0.000
      </span>
    );
  }

  return (
    <span className={`font-mono ${className ?? ""}`} aria-label={text} role="text">
      {text.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <DigitColumn key={i} digit={Number(ch)} instant={reduced} />
        ) : (
          <span key={i} aria-hidden>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
