// Shared provider catalog — the SINGLE source of truth for prices (docs/05).
// estCostAtomic is needed by the guardrails BEFORE any 402 response, so the price
// cannot come from the wire. Imported by BOTH discover() (agent side) and the
// mock-provider (server side), so a price is defined in exactly one place and can
// never drift between what the guard estimates and what the seller charges.
import { dollarsToAtomic } from "./usdc";
import type { Capability } from "./types";

export interface CatalogEntry {
  endpoint: string;
  name: string;
  capability: Capability;
  network: string;
  priceAtomic: number;
}

export const CATALOG: CatalogEntry[] = [
  { endpoint: "http://localhost:4021/holders",       name: "Provider A", capability: "holders",   network: "eip155:84532", priceAtomic: dollarsToAtomic(0.008) },
  { endpoint: "http://localhost:4021/liquidity",     name: "Provider C", capability: "liquidity", network: "eip155:84532", priceAtomic: dollarsToAtomic(0.010) },
  { endpoint: "http://localhost:4021/liquidity-bad", name: "Provider B", capability: "liquidity", network: "eip155:84532", priceAtomic: dollarsToAtomic(0.012) }, // the bad one — off-topic data
  { endpoint: "http://localhost:4021/audit",         name: "Provider D", capability: "audit",     network: "eip155:84532", priceAtomic: dollarsToAtomic(0.060) },
];

/** All catalog entries for a capability (used by discover() and the saved-by-memory baseline). */
export const catalogFor = (capability: Capability): CatalogEntry[] =>
  CATALOG.filter((e) => e.capability === capability);

/**
 * Most expensive catalog price for a capability — the per-sub-goal cost a naive agent would pay.
 * Basis of the deterministic "saved by memory" baseline (docs/05). 0 if no provider exists.
 */
export const maxPriceForCapability = (capability: Capability): number => {
  const prices = catalogFor(capability).map((e) => e.priceAtomic);
  return prices.length ? Math.max(...prices) : 0;
};
