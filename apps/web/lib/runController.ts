import type { RunConfig } from "@thinkpay/shared";
import { useThinkPay } from "./store";
import type { RunSource } from "./runSource";
import { simSource } from "./simSource";
import { liveSource } from "./liveSource";

/**
 * Plain functions bound to the store (no hook lifecycle bugs).
 * Components call these; the store + sceneBus fan the results out.
 */

let disconnect: (() => void) | null = null;

function getSource(): RunSource {
  return useThinkPay.getState().mode === "sim" ? simSource : liveSource;
}

export async function startRun(cfg: RunConfig): Promise<void> {
  const s = useThinkPay.getState();
  if (s.runStatus === "planning" || s.runStatus === "running" || s.runStatus === "awaiting_approval") {
    return; // one run at a time
  }
  const source = getSource();
  disconnect?.();

  try {
    const { runId } = await source.startRun(cfg);
    const warm = s.mode === "sim" && s.runCount >= 1;
    useThinkPay.getState().beginRun(runId, cfg.budgetUsd, cfg.perCallLimitUsd, warm);
    disconnect = source.connect(
      runId,
      (e) => useThinkPay.getState().ingestEvent(e),
      (c) => useThinkPay.getState().setConnection(c),
    );
    // refresh provider memory when the run completes
    const unsub = useThinkPay.subscribe((state, prev) => {
      if (prev.runStatus !== "done" && state.runStatus === "done") {
        void refetchProviders();
        unsub();
      }
    });
  } catch (err) {
    useThinkPay.getState().failRun(
      err instanceof Error && err.message.includes("fetch")
        ? "Could not reach the agent on :3001 — is it running? (or flip to SIM mode)"
        : err instanceof Error
          ? err.message
          : "Run failed to start",
    );
  }
}

export async function respondEscalation(decisionId: string, approve: boolean): Promise<void> {
  const { runId } = useThinkPay.getState();
  if (!runId) return;
  try {
    await getSource().approve(runId, decisionId, approve);
  } catch {
    useThinkPay.getState().failRun("Approval failed to reach the agent");
  }
}

export async function refetchProviders(): Promise<void> {
  try {
    const providers = await getSource().fetchProviders();
    useThinkPay.getState().setProviders(providers);
  } catch {
    // provider memory is non-critical — keep the last snapshot
  }
}
