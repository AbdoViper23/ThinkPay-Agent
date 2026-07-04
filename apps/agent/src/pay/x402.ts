// The ONLY module that reads EVM_PRIVATE_KEY and can sign. Never export the signer or key.
// Client is built lazily on first pay() so the entry script can load .env first.
import { wrapFetchWithPayment, x402Client, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
// Canonical PaidRequest lives with the guardrails (the shape the gate consumes).
import type { PaidRequest } from "../guardrails/types";

export type { PaidRequest };

export class PaymentError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "PaymentError";
  }
}

function buildClient() {
  const pk = process.env.EVM_PRIVATE_KEY;
  if (!pk) throw new PaymentError("EVM_PRIVATE_KEY missing in .env");
  const signer = privateKeyToAccount(pk as `0x${string}`);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  return {
    fetchWithPayment: wrapFetchWithPayment(fetch, client),
    httpClient: new x402HTTPClient(client),
  };
}

let cached: ReturnType<typeof buildClient> | null = null;
function getClient() {
  if (!cached) cached = buildClient();
  return cached;
}

export async function pay(
  req: PaidRequest,
): Promise<{ data: unknown; txHash: string | null; costAtomic: number; latencyMs: number }> {
  const { fetchWithPayment, httpClient } = getClient();
  const method = req.method ?? "GET";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);
  const t0 = Date.now();
  try {
    const res = await fetchWithPayment(req.endpoint, {
      method,
      signal: ac.signal,
      ...(method === "POST" && req.args
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.args) }
        : {}),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) throw new PaymentError(`paid call failed ${res.status}`, res.status);
    const data = await res.json();
    const receipt = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
    return { data, txHash: receipt?.transaction ?? null, costAtomic: req.estCostAtomic, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}
