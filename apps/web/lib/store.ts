import { create } from "zustand";
import type { Decision, ProviderStat, RunEvent, RunTotals } from "@thinkpay/shared";
import { dollarsToAtomic } from "@thinkpay/shared";

export type RunStatus = "idle" | "planning" | "running" | "awaiting_approval" | "done" | "error";
export type ConnState = "idle" | "connecting" | "open" | "closed" | "error";
export type Mode = "sim" | "live";
export type Gfx = "auto" | "off";

export interface CompletedRun {
  runId: string;
  totals: RunTotals;
  warm: boolean;
}

interface ThinkPayStore {
  mode: Mode;
  gfx: Gfx;
  runId: string | null;
  runCount: number; // completed+started runs — run 2+ is "warm" in sim
  runStatus: RunStatus;
  statusNote: string | null;
  connection: ConnState;
  runStartedAt: number | null;

  budgetAtomic: number;
  perCallLimitAtomic: number;

  decisions: Decision[];
  decisionIndex: Record<string, number>;
  pendingEscalations: Record<string, { reason: string }>;

  /** derived incrementally per event so the meter moves BEFORE `done` */
  live: { spentToolAtomic: number; savedCacheAtomic: number };
  totals: RunTotals | null;
  report: string | null; // the agent's final composed analysis, set on `done`

  providers: ProviderStat[];
  completedRuns: CompletedRun[];
  error: string | null;

  // actions
  setMode: (m: Mode) => void;
  setGfx: (g: Gfx) => void;
  setConnection: (c: ConnState) => void;
  setProviders: (p: ProviderStat[]) => void;
  beginRun: (runId: string, budgetUsd: number, perCallLimitUsd: number) => void;
  ingestEvent: (e: RunEvent) => void;
  failRun: (message: string) => void;
  reset: () => void;
}

export const useThinkPay = create<ThinkPayStore>()((set, get) => ({
  mode: (process.env.NEXT_PUBLIC_SIM_MODE ?? "1") !== "0" ? "sim" : "live",
  gfx: "auto",
  runId: null,
  runCount: 0,
  runStatus: "idle",
  statusNote: null,
  connection: "idle",
  runStartedAt: null,

  budgetAtomic: 0,
  perCallLimitAtomic: 0,

  decisions: [],
  decisionIndex: {},
  pendingEscalations: {},

  live: { spentToolAtomic: 0, savedCacheAtomic: 0 },
  totals: null,
  report: null,

  providers: [],
  completedRuns: [],
  error: null,

  setMode: (mode) => set({ mode }),
  setGfx: (gfx) => set({ gfx }),
  setConnection: (connection) => set({ connection }),
  setProviders: (providers) => set({ providers }),

  beginRun: (runId, budgetUsd, perCallLimitUsd) => {
    set({
      runId,
      runCount: get().runCount + 1,
      runStatus: "planning",
      statusNote: null,
      runStartedAt: Date.now(),
      budgetAtomic: dollarsToAtomic(budgetUsd),
      perCallLimitAtomic: dollarsToAtomic(perCallLimitUsd),
      decisions: [],
      decisionIndex: {},
      pendingEscalations: {},
      live: { spentToolAtomic: 0, savedCacheAtomic: 0 },
      totals: null,
      report: null,
      error: null,
    });
  },

  ingestEvent: (e) => {
    const s = get();
    switch (e.type) {
      case "status": {
        const state = e.data.state;
        set({
          runStatus:
            state === "planning" || state === "running" || state === "awaiting_approval" || state === "done" || state === "error"
              ? state
              : s.runStatus,
          statusNote: e.data.note ?? s.statusNote,
        });
        break;
      }
      case "decision":
      case "decision:update": {
        const d = e.data;
        const idx = s.decisionIndex[d.id];
        const decisions = s.decisions.slice();
        let decisionIndex = s.decisionIndex;
        if (idx === undefined) {
          decisionIndex = { ...decisionIndex, [d.id]: decisions.length };
          decisions.push(d);
        } else {
          decisions[idx] = { ...decisions[idx], ...d };
        }

        // incremental live totals — recompute from the array (≤ ~12 rows in a run, trivially cheap and always right)
        let spent = 0;
        let savedCache = 0;
        for (const row of decisions) {
          if (row.paidCostAtomic != null) spent += row.paidCostAtomic;
          if (row.guardrail === "use_cache") savedCache += row.savedAtomic;
        }

        // a settled update clears any pending escalation for that id
        const pendingEscalations = { ...s.pendingEscalations };
        if (d.guardrail !== "pending" && pendingEscalations[d.id]) {
          delete pendingEscalations[d.id];
        }
        const stillPending = Object.keys(pendingEscalations).length > 0;

        set({
          decisions,
          decisionIndex,
          live: { spentToolAtomic: spent, savedCacheAtomic: savedCache },
          pendingEscalations,
          runStatus: stillPending ? "awaiting_approval" : s.runStatus === "awaiting_approval" ? "running" : s.runStatus,
        });
        break;
      }
      case "escalation": {
        set({
          pendingEscalations: { ...s.pendingEscalations, [e.data.decisionId]: { reason: e.data.reason } },
          runStatus: "awaiting_approval",
        });
        break;
      }
      case "done": {
        const warm = s.runCount > 1;
        set({
          totals: e.data,
          report: e.data.report ?? null,
          runStatus: "done",
          statusNote: null,
          completedRuns: [...s.completedRuns, { runId: s.runId ?? "?", totals: e.data, warm }],
        });
        break;
      }
    }
  },

  failRun: (message) => set({ runStatus: "error", error: message }),

  reset: () =>
    set({
      runId: null,
      runStatus: "idle",
      statusNote: null,
      decisions: [],
      decisionIndex: {},
      pendingEscalations: {},
      live: { spentToolAtomic: 0, savedCacheAtomic: 0 },
      totals: null,
      report: null,
      error: null,
    }),
}));

/** true while at least one escalation awaits the human */
export const selectHasPending = (s: ThinkPayStore) => Object.keys(s.pendingEscalations).length > 0;
