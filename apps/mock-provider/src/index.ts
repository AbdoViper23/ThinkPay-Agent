import { config } from "dotenv";
import { fileURLToPath } from "node:url";
// load repo-root .env regardless of cwd
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

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

// Phase 0: ONE paid route is enough to prove settlement. The other 3 arrive in Phase 1.
app.use(
  paymentMiddleware(
    {
      "GET /holders": {
        accepts: { scheme: "exact", price: "$0.008", network: NETWORK, payTo },
        description: "Holder distribution",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

// Handler runs ONLY after payment clears.
app.get("/holders", (_req, res) => res.json({ top10Pct: 42, holders: 1873 }));

app.listen(PORT, () => {
  console.log(`mock provider on :${PORT} (Base Sepolia)`);
  console.log(`  payTo:       ${payTo}`);
  console.log(`  facilitator: ${facilitatorUrl}`);
  console.log(`  free:  GET http://localhost:${PORT}/health`);
  console.log(`  paid:  GET http://localhost:${PORT}/holders  ($0.008)`);
});
