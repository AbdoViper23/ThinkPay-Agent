import type { RunConfig } from "@thinkpay/shared";
import { useThinkPay } from "./store";
import type { RunSource } from "./runSource";
import { simSource } from "./simSource";
import { liveSource } from "./liveSource";

/**
 * Plain functions bound to the store (no hook lifecycle bugs).
 * Components call these; the store fans the results out.
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
    useThinkPay.getState().beginRun(runId, cfg.budgetUsd, cfg.perCallLimitUsd);
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

// Guards against a double-fire (button click + "a"/"d" hotkey, or a double-click) sending
// two approve POSTs — the second would 404 and, before, surfaced a spurious error.
const approvalsInFlight = new Set<string>();

export async function respondEscalation(decisionId: string, approve: boolean): Promise<void> {
  const { runId } = useThinkPay.getState();
  if (!runId || approvalsInFlight.has(decisionId)) return;
  approvalsInFlight.add(decisionId);
  try {
    await getSource().approve(runId, decisionId, approve);
  } catch {
    // Transient failure only (404-already-resolved is swallowed in the source). The
    // authoritative outcome still arrives on the SSE `decision:update`, so don't fail the
    // whole run over a flaky approve POST — leave the escalation actionable.
  } finally {
    approvalsInFlight.delete(decisionId);
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
