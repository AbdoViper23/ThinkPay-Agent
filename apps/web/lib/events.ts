import type { RunEvent } from "@thinkpay/shared";

/**
 * sceneBus — a tiny pub/sub the three.js scene subscribes to.
 * The DOM reads state through zustand selectors; the 3D layer listens here
 * imperatively so decision events NEVER re-render the Canvas.
 */
export type SceneEvent =
  | { kind: "run"; event: RunEvent }
  | { kind: "warm" } // this run is a warm run — pre-light the vault
  | { kind: "glint" }; // small brass ping at the ledger anchor (e.g. tx copy)

type Listener = (e: SceneEvent) => void;

const listeners = new Set<Listener>();

export const sceneBus = {
  emit(e: SceneEvent) {
    for (const l of listeners) l(e);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
