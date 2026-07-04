# 07 — x402 Payments (`apps/agent/src/pay/x402.ts` + `apps/mock-provider`)

This is where money moves. Read the whole file before writing payment code. Use the **V2 scoped `@x402/*` packages** throughout (this is what Coinbase's current quickstarts use).

## Mental model

An x402 request is: hit endpoint → get **HTTP 402** with `PAYMENT-REQUIRED` (amount, asset, network, `payTo`) → sign a gasless **EIP-3009** USDC authorization locally → retry with the payment header → server verifies + settles via a facilitator → returns `200` + `PAYMENT-RESPONSE` (tx hash). The client SDK does all of this transparently; from the agent's side it looks like a normal `fetch` that happens to cost money. **The private key is used to sign locally and never leaves the process.**

## The buyer / client (the "hands") — only place the key lives

`apps/agent/src/pay/x402.ts`:

```ts
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// 1) signer from the agent's own key (env only, never logged, never in a prompt)
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

// 2) x402 client with the EVM "exact" scheme registered
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// 3) fetch that auto-handles 402
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const httpClient = new x402HTTPClient(client);

export class PaymentError extends Error {
  constructor(message: string, public status?: number) { super(message); this.name = "PaymentError"; }
}

export interface PaidRequest {
  endpoint: string;
  method?: "GET" | "POST";
  args?: unknown;            // used by guardrails for the dedupe hash; NOT sent on a GET
  estCostAtomic: number;     // set by buildToolCall() from the catalog price, BEFORE we get here
  approved?: boolean;        // set by the escalation path; not used inside pay()
}

export async function pay(req: PaidRequest): Promise<{ data: unknown; txHash: string | null; costAtomic: number; latencyMs: number }> {
  const t0 = Date.now();
  const method = req.method ?? "GET";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);   // per-call timeout: a hung provider must not freeze the loop/SSE
  try {
    const res = await fetchWithPayment(req.endpoint, {
      method,
      signal: ac.signal,
      // send a JSON body ONLY on POST — a GET with a body is invalid; the mock endpoints are argless GETs
      ...(method === "POST" && req.args ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.args) } : {}),
    });
    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      // 4xx/5xx => payment NOT settled, wallet NOT charged
      throw new PaymentError(`paid call failed ${res.status}`, res.status);
    }

    const data = await res.json();
    // settlement receipt (tx hash) from response headers
    const receipt = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
    // costAtomic = the known catalog price (== the 402 amount); this is what the ledger records as paidCostAtomic
    return { data, txHash: receipt?.transaction ?? null, costAtomic: req.estCostAtomic, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}
```

Notes:
- `pay()` is called **only after** `guardrails.evaluate()` returns `{ action: "pay" }`. Never call it directly from the LLM path.
- Do not export `signer` or the key. Keep this module's surface to `pay()`, `PaymentError`, and `PaidRequest`.
- **There is NO built-in ~0.1 USDC client cap in the V2 `@x402/*` packages** (that was legacy `x402-fetch`'s third `wrapFetchWithPayment` arg). `wrapFetchWithPayment(fetch, client)` takes only two args. Mizan's deterministic guardrails are the real cap, so this doesn't matter functionally. If you want an in-client backstop, register an opt-in `PaymentPolicy` on the client that filters payment requirements by amount — but note it is applied at import time and would **reject the human-approved over-per-call audit** (the demo's escalation beat), so if you add one, set it to the run **budget**, not the per-call limit, or skip it entirely.
- USDC settles only on a 2xx. On failure (including a timeout `AbortError`) the wallet is not charged, so surface the error and let the loop treat it as no-progress.

## The seller / mock provider (so the demo never depends on a flaky third party)

`apps/mock-provider/src/index.ts`:

```ts
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();
const payTo = process.env.SERVER_PAY_TO_ADDRESS as `0x${string}`;
const facilitator = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const resourceServer = new x402ResourceServer(facilitator).register("eip155:84532", new ExactEvmScheme());

// Prices MUST match packages/shared/src/catalog.ts (same $ values). Keep them in sync — the catalog
// is the single source of truth the guardrails estimate against; a drift here means estCost != charge.
app.use(
  paymentMiddleware(
    {
      "GET /holders":       { accepts: { scheme: "exact", price: "$0.008", network: "eip155:84532", payTo }, description: "Holder distribution", mimeType: "application/json" },
      "GET /liquidity":     { accepts: { scheme: "exact", price: "$0.010", network: "eip155:84532", payTo }, description: "Liquidity snapshot", mimeType: "application/json" },
      "GET /liquidity-bad": { accepts: { scheme: "exact", price: "$0.012", network: "eip155:84532", payTo }, description: "Liquidity snapshot (bad provider)", mimeType: "application/json" },
      "GET /audit":         { accepts: { scheme: "exact", price: "$0.060", network: "eip155:84532", payTo }, description: "Contract security scan", mimeType: "application/json" },
    },
    resourceServer,
  ),
);

// handlers run ONLY after payment clears
app.get("/holders",       (_req, res) => res.json({ top10Pct: 42, holders: 1873 }));
app.get("/liquidity",     (_req, res) => res.json({ tvlUsd: 254000, pool: "USDC/X" }));
app.get("/liquidity-bad", (_req, res) => res.json({ note: "top gainers today", coins: ["DOGE", "PEPE"] })); // OFF-TOPIC on purpose
app.get("/audit",         (_req, res) => res.json({ risk: "medium", findings: ["unverified proxy admin"] }));

app.listen(4021, () => console.log("mock provider on :4021 (Base Sepolia)"));
```

The **rejected-provider** beat is `/liquidity-bad`: it charges like a liquidity provider but returns off-topic data, so the verify judge fails it, its accuracy score drops below the reject floor, and the warm run skips it. The seeded "Provider B" points here (`05` catalog).

## Facilitator, network, funding

- Testnet facilitator: `https://x402.org/facilitator` (no signup). CAIP-2 network `eip155:84532` (Base Sepolia). Mainnet later: `https://api.cdp.coinbase.com/platform/v2/x402` + `eip155:8453`.
- USDC (Base Sepolia): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. **6 decimals.**
- Wallet funding, stated plainly (the earlier wording was self-contradictory):
  - **Buyer wallet** (`EVM_PRIVATE_KEY`): fund with **test USDC only** from the Circle faucet (`https://faucet.circle.com`). It needs **no ETH** on testnet — it signs a gasless EIP-3009 authorization; the facilitator submits the on-chain tx and pays the gas.
  - **`SERVER_PAY_TO_ADDRESS`**: a receive-only address. Needs **nothing** — no USDC, no ETH.
  - The x402.org facilitator sponsors settlement gas on testnet. Verify this empirically in Milestone A before assuming it.
- Even ~$5 of USDC is ~500 calls at $0.01 — plenty for a demo.

## Real endpoints (optional, for credibility)

If you want a live third-party call in the demo alongside the mocks, discover current ones at `https://x402scan.com`. Known-live categories: market data (CoinGecko `/x402/` path), web extraction (Firecrawl), inference (Hyperbolic). Keep the mock provider as the primary so a third-party outage can't break the demo. Avoid aixbt pay-per-use (deprecating 2026-07-15).

## Gotchas (these cost people hours)

- **USDC = 6 decimals.** `$0.10` = `100000` atomic units. Never 18.
- **USDC only.** EIP-3009 gasless transfer is native to USDC; USDT won't work.
- **Testnet vs mainnet mismatch fails silently.** Keep facilitator URL and network ID consistent. Base Sepolia = `eip155:84532`.
- **Middleware ordering.** `@x402/express` returns 402 for any matched route without a valid payment header. Mount the payment middleware for paid routes only, before their handlers; keep health/free routes outside it.
- **Settle-after-verify.** Content is returned after `verify` but before final on-chain `settle`; the tx hash arrives in `PAYMENT-RESPONSE`. Treat a missing hash as "pending", not "free".
- **Don't mix package families.** V2 scoped `@x402/*` on both client and server. The legacy `x402-fetch`/`x402-express` have simpler signatures but different types; mixing causes confusing scheme errors.
- **Never commit `.env`.** The key is the wallet. `.gitignore` it; commit `.env.example` with blanks.

## Env

```
EVM_PRIVATE_KEY=0x...                 # agent buyer wallet (fund with test USDC)
SERVER_PAY_TO_ADDRESS=0x...           # mock provider receiving address
X402_FACILITATOR_URL=https://x402.org/facilitator
```
