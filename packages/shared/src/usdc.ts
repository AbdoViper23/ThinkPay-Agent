// Atomic-USDC helpers — docs/05. USDC has 6 decimals; all money is integer atomic units internally.
export const USDC_DECIMALS = 6;
export const dollarsToAtomic = (usd: number) => Math.round(usd * 10 ** USDC_DECIMALS); // $0.10 -> 100000
export const atomicToDollars = (a: number) => a / 10 ** USDC_DECIMALS;
export const formatUsd = (a: number) => `$${atomicToDollars(a).toFixed(3)}`;
