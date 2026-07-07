// The agent API + SSE server (docs/03, Phase 4). The dashboard's read/control plane.
// Layers stay separated: this HTTP layer only reads the run config, kicks the loop, and fans the
// loop's RunEvents out over SSE. It NEVER signs — pay() (inside the loop) is the sole signer.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import express, { type Request, type Response } from "express";
import cors from "cors";
import type { RunConfig, RunEvent } from "@thinkpay/shared";
import { createRun, finishRun, setRunStatus } from "./ledger";
import { allProvidersRanked } from "./memory";
import { runLoop, type RunHooks } from "./loop";

const PORT = 3001;
const WEB_ORIGIN = "http://localhost:3000";
const APPROVAL_TIMEOUT_MS = 60_000; // auto-DENY a pending escalation after 60s (docs/03)

/** Per-run event bus: a buffer to replay on connect + the live SSE clients + pending approvals. */
interface RunHub {
  events: RunEvent[];
  clients: Set<Response>;
  approvals: Map<string, (approved: boolean) => void>;
}

const hubs = new Map<string, RunHub>();
function getHub(runId: string): RunHub {
  let hub = hubs.get(runId);
  if (!hub) {
    hub = { events: [], clients: new Set(), approvals: new Map() };
    hubs.set(runId, hub);
  }
  return hub;
}

function writeEvent(res: Response, e: RunEvent): void {
  res.write(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);
}

/** Buffer the event (for replay-on-connect) and push it to every attached SSE client. */
function emit(runId: string, e: RunEvent): void {
  const hub = getHub(runId);
  hub.events.push(e);
  for (const client of hub.clients) writeEvent(client, e);
}

const app = express();
app.use(cors({ origin: WEB_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// The memory view — no SSE channel, so the dashboard polls this on mount + after each run.
app.get("/providers", (_req, res) => {
  res.json(allProvidersRanked());
});

// Start a run: persist it, respond with its id immediately, then drive the loop asynchronously.
app.post("/run", (req: Request, res: Response) => {
  const body = req.body as Partial<RunConfig>;
  if (
    typeof body?.task !== "string" ||
    body.task.trim().length === 0 ||
    typeof body.budgetUsd !== "number" ||
    typeof body.perCallLimitUsd !== "number"
  ) {
    return res.status(400).json({ error: "expected { task: string, budgetUsd: number, perCallLimitUsd: number }" });
  }
  const cfg: RunConfig = { task: body.task, budgetUsd: body.budgetUsd, perCallLimitUsd: body.perCallLimitUsd };
  const run = createRun(cfg);
  getHub(run.runId); // create the hub NOW so a stream connecting a beat later finds it
  res.json({ runId: run.runId });

  void driveRun(run.runId, run, cfg);
});

async function driveRun(runId: string, run: ReturnType<typeof createRun>, cfg: RunConfig): Promise<void> {
  const hub = getHub(runId);
  const hooks: RunHooks = {
    emit: (e) => emit(runId, e),
    awaitApproval: (decisionId) => {
      setRunStatus(runId, "awaiting_approval");
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          hub.approvals.delete(decisionId);
          setRunStatus(runId, "running");
          resolve(false); // no human in 60s → auto-deny
        }, APPROVAL_TIMEOUT_MS);
        hub.approvals.set(decisionId, (approved) => {
          clearTimeout(timer);
          hub.approvals.delete(decisionId);
          setRunStatus(runId, "running");
          resolve(approved);
        });
      });
    },
  };

  try {
    const { totals, report } = await runLoop(run, cfg, hooks);
    finishRun(runId, totals, "done"); // persist totals so runs table == the `done` event (acceptance #3)
    emit(runId, { type: "done", data: { ...totals, report } }); // report = the agent's final analysis
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`✗ run ${runId} failed:`, message);
    setRunStatus(runId, "error");
    emit(runId, { type: "status", data: { state: "error", note: message } });
  }
}

// SSE stream for a run: replay everything already buffered, then stream live until the client leaves.
app.get("/run/:runId/stream", (req: Request, res: Response) => {
  const runId = String(req.params.runId);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(":ok\n\n"); // open the stream

  const hub = getHub(runId);
  for (const e of hub.events) writeEvent(res, e); // replay-on-connect (covers the POST→EventSource gap)
  hub.clients.add(res);

  req.on("close", () => {
    hub.clients.delete(res);
  });
});

// Resolve a pending escalation (approve/deny). Path carries runId; body carries decisionId + approve.
app.post("/run/:runId/approve", (req: Request, res: Response) => {
  const runId = String(req.params.runId);
  const { decisionId, approve } = (req.body ?? {}) as { decisionId?: string; approve?: boolean };
  const resolver = decisionId ? hubs.get(runId)?.approvals.get(decisionId) : undefined;
  if (!resolver) {
    return res.status(404).json({ error: "no pending escalation for that runId/decisionId" });
  }
  resolver(Boolean(approve));
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`ThinkPay agent API on http://localhost:${PORT}  (CORS origin ${WEB_ORIGIN})`);
});
