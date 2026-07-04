import { config } from "dotenv";
import { fileURLToPath } from "node:url";
// load repo-root .env regardless of cwd
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient, type RouteConfig } from "@x402/core/server";
import { CATALOG, formatUsd } from "@thinkpay/shared";

const PORT = 4021;
const NETWORK = "eip155:84532"; // Base Sepolia
const payTo = process.env.SERVER_PAY_TO_ADDRESS as `0x${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

if (!payTo) {
  console.error("✗ SERVER_PAY_TO_ADDRESS is missing in .env — set it before starting the mock provider.");
  process.exit(1);
}

const app = express();
app.use(express.json());

// Free, unguarded route (must live OUTSIDE the payment middleware).
app.get("/health", (_req, res) => res.json({ ok: true, network: NETWORK, facilitator: facilitatorUrl }));

const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());

// Phase 1: all 4 paid routes. Prices come from the SHARED CATALOG so the seller charge
// can never drift from the guardrail's pre-payment estimate (single source of truth, docs/05).
const DESCRIPTIONS: Record<string, string> = {
  "/holders": "Holder distribution",
  "/liquidity": "Liquidity / TVL snapshot",
  "/liquidity-bad": "Liquidity snapshot (unreliable provider)",
  "/audit": "Contract security scan",
};

const routes: Record<string, RouteConfig> = {};
for (const c of CATALOG) {
  const path = new URL(c.endpoint).pathname; // "/holders" etc.
  routes[`GET ${path}`] = {
    accepts: { scheme: "exact", price: formatUsd(c.priceAtomic), network: NETWORK, payTo },
    description: DESCRIPTIONS[path] ?? c.name,
    mimeType: "application/json",
  };
}

app.use(paymentMiddleware(routes, resourceServer));

// Handlers run ONLY after payment clears.
app.get("/holders", (_req, res) => res.json({ top10Pct: 42, holders: 1873, symbol: "XYZ" }));

// Provider C — good, on-topic liquidity data.
app.get("/liquidity", (_req, res) =>
  res.json({ tvlUsd: 1_250_000, poolDepthUsd: 340_000, pair: "XYZ/USDC", dex: "uniswap-v3" }),
);

// Provider B — the BAD one: pays fine, but returns OFF-TOPIC data so the verify judge
// (Phase 3) rejects it and its accuracy score drops. This is the anti-garbage demo beat.
app.get("/liquidity-bad", (_req, res) =>
  res.json({ note: "server busy, partial data", weatherSf: "68F", unrelatedId: "abc-123" }),
);

// Provider D — contract security scan.
app.get("/audit", (_req, res) =>
  res.json({ score: 87, risk: "low", issues: [], honeypot: false, mintable: false }),
);

app.listen(PORT, () => {
  console.log(`mock provider on :${PORT} (Base Sepolia)`);
  console.log(`  payTo:       ${payTo}`);
  console.log(`  facilitator: ${facilitatorUrl}`);
  console.log(`  free:  GET http://localhost:${PORT}/health`);
  for (const c of CATALOG) {
    console.log(`  paid:  GET ${c.endpoint}  (${formatUsd(c.priceAtomic)})`);
  }
});
