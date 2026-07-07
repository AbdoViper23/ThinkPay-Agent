import type { ProviderStat, RunConfig, RunEvent } from "@thinkpay/shared";
import type { RunSource } from "./runSource";
import type { ConnState } from "./store";
import { AGENT_URL } from "./config";

/**
 * The real docs/03 contract. Written now, exercised when the agent API lands
 * (backend Phase 4). Requires cors({origin:"http://localhost:3000"}) server-side.
 */
export const liveSource: RunSource = {
  async startRun(cfg: RunConfig) {
    const res = await fetch(`${AGENT_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    if (!res.ok) throw new Error(`POST /run failed: ${res.status}`);
    return (await res.json()) as { runId: string };
  },

  connect(runId, onEvent, onConn) {
    onConn("connecting");
    const es = new EventSource(`${AGENT_URL}/run/${runId}/stream`);

    es.onopen = () => onConn("open");
    es.onerror = () => onConn("error");

    const forward = (type: RunEvent["type"]) => (ev: MessageEvent) => {
      try {
        onEvent({ type, data: JSON.parse(ev.data) } as RunEvent);
      } catch {
        // malformed frame — ignore rather than crash the stream
      }
    };

    es.addEventListener("status", forward("status"));
    es.addEventListener("decision", forward("decision"));
    es.addEventListener("decision:update", forward("decision:update"));
    es.addEventListener("escalation", forward("escalation"));
    es.addEventListener("done", (ev) => {
      forward("done")(ev as MessageEvent);
      es.close();
      onConn("closed");
    });

    return () => {
      es.close();
      onConn("closed");
    };
  },

  async approve(runId, decisionId, approve) {
    const res = await fetch(`${AGENT_URL}/run/${runId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId, approve }),
    });
    // 404 = the escalation is no longer pending (already resolved by a prior click, or
    // auto-resolved). That is a success state for the caller, not an error — the real
    // outcome arrives on the SSE `decision:update`. Only genuine transport/5xx failures throw.
    if (res.status === 404) return;
    if (!res.ok) throw new Error(`POST /run/${runId}/approve failed: ${res.status}`);
  },

  async fetchProviders() {
    const res = await fetch(`${AGENT_URL}/providers`);
    if (!res.ok) throw new Error(`GET /providers failed: ${res.status}`);
    return (await res.json()) as ProviderStat[];
  },
};
