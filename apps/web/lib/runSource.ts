import type { ProviderStat, RunConfig, RunEvent } from "@mizan/shared";
import type { ConnState } from "./store";

/**
 * The seam that makes sim/live interchangeable. liveSource speaks the real
 * docs/03 HTTP+SSE contract; simSource replays the scripted demo through the
 * exact same interface (including a genuinely-blocking escalation approval).
 */
export interface RunSource {
  startRun(cfg: RunConfig): Promise<{ runId: string }>;
  connect(
    runId: string,
    onEvent: (e: RunEvent) => void,
    onConn: (s: ConnState) => void,
  ): () => void; // returns disconnect()
  approve(runId: string, decisionId: string, approve: boolean): Promise<void>;
  fetchProviders(): Promise<ProviderStat[]>;
}
