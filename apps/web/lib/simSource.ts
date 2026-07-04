import type { ProviderStat, RunConfig, RunEvent } from "@thinkpay/shared";
import type { RunSource } from "./runSource";
import type { ConnState } from "./store";
import { coldRunScript, warmRunScript, providersEmpty, type SimStep, type BranchStep } from "./sim/script";

/**
 * The Simulator — replays the scripted docs/09 demo through the exact RunSource
 * interface. Escalations genuinely BLOCK: the script suspends on a pending
 * promise keyed by decisionId (mirroring the backend's awaitApproval Map) until
 * the user clicks Approve/Deny in the UI, or the timeout auto-denies.
 */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class Simulator implements RunSource {
  private runCount = 0;
  private providersSnapshot: ProviderStat[] = providersEmpty;
  private scripts = new Map<string, SimStep[]>();
  private pendingApprovals = new Map<string, (approved: boolean) => void>();
  private cancelled = new Set<string>();

  async startRun(_cfg: RunConfig): Promise<{ runId: string }> {
    this.runCount += 1;
    const warm = this.runCount > 1;
    const runId = warm ? `sim-warm-${this.runCount}` : `sim-cold-${this.runCount}`;
    this.scripts.set(runId, warm ? warmRunScript(runId) : coldRunScript(runId));
    return { runId };
  }

  connect(runId: string, onEvent: (e: RunEvent) => void, onConn: (s: ConnState) => void): () => void {
    const script = this.scripts.get(runId);
    onConn("connecting");
    if (!script) {
      onConn("error");
      return () => {};
    }
    onConn("open");
    void this.play(runId, script, onEvent, onConn);
    return () => {
      this.cancelled.add(runId);
      onConn("closed");
    };
  }

  private async play(runId: string, script: SimStep[], onEvent: (e: RunEvent) => void, onConn: (s: ConnState) => void) {
    const t0 = Date.now();
    const elapsed = () => Date.now() - t0;

    for (const step of script) {
      if (this.cancelled.has(runId)) return;
      const wait = step.at - elapsed();
      if (wait > 0) await sleep(wait);
      if (this.cancelled.has(runId)) return;

      if ("emit" in step) {
        onEvent(this.stamp(step.emit, t0));
      } else if ("providers" in step) {
        this.providersSnapshot = step.providers;
      } else {
        // ── blocking escalation — exactly like the backend's Map<decisionId, resolve>
        const { decisionId, timeoutMs, approved, denied } = step.awaitApproval;
        const verdict = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => {
            this.pendingApprovals.delete(decisionId);
            resolve(false); // auto-deny on timeout
          }, timeoutMs);
          this.pendingApprovals.set(decisionId, (ok) => {
            clearTimeout(timer);
            this.pendingApprovals.delete(decisionId);
            resolve(ok);
          });
        });
        if (this.cancelled.has(runId)) return;

        const branch: BranchStep[] = verdict ? approved : denied;
        const b0 = Date.now();
        for (const b of branch) {
          const bWait = b.after - (Date.now() - b0);
          if (bWait > 0) await sleep(bWait);
          if (this.cancelled.has(runId)) return;
          if ("emit" in b) onEvent(this.stamp(b.emit, t0));
          else this.providersSnapshot = b.providers;
        }
      }
    }
    onConn("closed");
  }

  /** rewrite script-relative createdAt (ms since run start) into wall-clock time */
  private stamp(e: RunEvent, t0: number): RunEvent {
    if ((e.type === "decision" || e.type === "decision:update") && e.data.createdAt < 1e12) {
      return { ...e, data: { ...e.data, createdAt: t0 + e.data.createdAt } };
    }
    return e;
  }

  async approve(_runId: string, decisionId: string, approve: boolean): Promise<void> {
    this.pendingApprovals.get(decisionId)?.(approve);
  }

  async fetchProviders(): Promise<ProviderStat[]> {
    return this.providersSnapshot;
  }
}

export const simSource: RunSource = new Simulator();
