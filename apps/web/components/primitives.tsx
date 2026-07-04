"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SPRING, TIMING } from "@/lib/motion";

/* ── verdict marks: crisp inline SVGs (text glyphs like ⚠ emoji-render) ── */
export type MarkKind = "check" | "cross" | "cache" | "block" | "pending" | "dot";

export function MarkIcon({ kind, size = 14 }: { kind: MarkKind; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "check":
      return (
        <svg {...p}>
          <path d="M2.8 8.4l3.4 3.4 7-7.6" />
        </svg>
      );
    case "cross":
      return (
        <svg {...p}>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      );
    case "cache":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M4.8 11.2l6.4-6.4" />
        </svg>
      );
    case "block":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M5 8h6" />
        </svg>
      );
    case "pending":
      return (
        <svg {...p}>
          <path d="M8 3.4v5" />
          <circle cx="8" cy="11.6" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "dot":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export type Tone = "ok" | "bad" | "brass" | "mid";
const TONE: Record<Tone, string> = {
  ok: "text-ok-bright",
  bad: "text-bad-bright",
  brass: "text-brass-bright",
  mid: "text-t-mid",
};

/* ── verdict stamp: scales 1.4→1 with a 1-frame ink-bleed ── */
export function Stamp({ children, tone, delay = 0 }: { children: React.ReactNode; tone: Tone; delay?: number }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.span
      className={`inline-flex ${TONE[tone]}`}
      initial={reduced ? { opacity: 0 } : { scale: 1.4, opacity: 0, filter: "blur(2px)" }}
      animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, filter: "blur(0px)" }}
      transition={reduced ? { duration: 0.12 } : { ...SPRING.stamp, delay }}
    >
      {children}
    </motion.span>
  );
}

/* ── tx hash resolves from random hex → real value, click to copy ── */
const HEX = "0123456789abcdef";
export function HashResolve({ hash, delay = 0 }: { hash: string; delay?: number }) {
  const short = `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  const reduced = useReducedMotion() ?? false;
  const [text, setText] = useState(reduced ? short : "0x————…————");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (reduced) {
      setText(short);
      return;
    }
    let frame = 0;
    const start = setTimeout(() => {
      const id = setInterval(() => {
        frame += 1;
        if (frame >= 8) {
          setText(short);
          clearInterval(id);
        } else {
          const r = (n: number) => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join("");
          setText(`0x${r(4)}…${r(4)}`);
        }
      }, 25);
    }, delay * 1000);
    return () => clearTimeout(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      className="group/hash inline-flex items-center gap-1.5 font-mono text-[11px] text-brass/80 transition-colors hover:text-brass-bright"
      title={`${hash} — click to copy`}
      aria-label={`transaction ${hash}, click to copy`}
    >
      <span className="border-b border-transparent transition-colors group-hover/hash:border-brass-dim">{text}</span>
      {copied ? (
        <span className="text-ok-bright">
          <MarkIcon kind="check" size={11} />
        </span>
      ) : (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="opacity-50">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M3.5 10.5h-.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v.5" />
        </svg>
      )}
    </button>
  );
}

/* ── empty-state line types on, char by char ── */
export function TypeLine({ text, startDelay = 0 }: { text: string; startDelay?: number }) {
  const reduced = useReducedMotion() ?? false;
  const [n, setN] = useState(reduced ? text.length : 0);

  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const start = setTimeout(() => {
      const id = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length) clearInterval(id);
      }, TIMING.typeCharMs);
    }, startDelay * 1000);
    return () => clearTimeout(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span>
      {text.slice(0, n)}
      <span className="caret" aria-hidden />
    </span>
  );
}
