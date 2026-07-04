"use client";

import { useEffect } from "react";
import { useThinkPay } from "./store";
import { refetchProviders } from "./runController";

/** Boot-time wiring: fetch provider memory on mount. */
export function useProvidersOnMount() {
  useEffect(() => {
    void refetchProviders();
  }, []);
}

/** Elapsed ms since run start, ticking — for the "running" button state. */
export function useRunElapsed(): number | null {
  const startedAt = useThinkPay((s) => s.runStartedAt);
  const status = useThinkPay((s) => s.runStatus);
  const running = status === "planning" || status === "running" || status === "awaiting_approval";
  const now = useTick(running ? 150 : null);
  if (!startedAt || !running) return null;
  return now - startedAt;
}

import { useState } from "react";
function useTick(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs == null) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
