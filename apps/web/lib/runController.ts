import type { RunConfig } from "@mizan/shared";
import { useMizan } from "./store";
import type { RunSource } from "./runSource";
import { simSource } from "./simSource";
import { liveSource } from "./liveSource";

/**
 * Plain functions bound to the store (no hook lifecycle bugs).
 * Components call these; the store + sceneBus fan the results out.
 */

let disconnect: (() => void) | null = null;

function getSource(): RunSource {
  return useMizan.getState().mode === "sim" ? simSource : liveSource;
}

export async function startRun(cfg: RunConfig): Promise<void> {
  const s = useMizan.getState();
  if (s.runStatus === "planning" || s.runStatus === "running" || s.runStatus === "awaiting_approval") {
    return; // one run at a time
  }
  const source = getSource();
  disconnect?.();

  try {
    const { runId } = await source.startRun(cfg);
    const warm = s.mode === "sim" && s.runCount >= 1;
    useMizan.getState().beginRun(runId, cfg.budgetUsd, cfg.perCallLimitUsd, warm);
    disconnect = source.connect(
      runId,
      (e) => useMizan.getState().ingestEvent(e),
      (c) => useMizan.getState().setConnection(c),
    );
    // refresh provider memory when the run completes
    const unsub = useMizan.subscribe((state, prev) => {
      if (prev.runStatus !== "done" && state.runStatus === "done") {
        void refetchProviders();
        unsub();
      }
    });
  } catch (err) {
    useMizan.getState().failRun(
      err instanceof Error && err.message.includes("fetch")
        ? "Could not reach the agent on :3001 — is it running? (or flip to SIM mode)"
        : err instanceof Error
          ? err.message
          : "Run failed to start",
    );
  }
}

export async function respondEscalation(decisionId: string, approve: boolean): Promise<void> {
  const { runId } = useMizan.getState();
  if (!runId) return;
  try {
    await getSource().approve(runId, decisionId, approve);
  } catch {
    useMizan.getState().failRun("Approval failed to reach the agent");
  }
}

export async function refetchProviders(): Promise<void> {
  try {
    const providers = await getSource().fetchProviders();
    useMizan.getState().setProviders(providers);
  } catch {
    // provider memory is non-critical — keep the last snapshot
  }
}
