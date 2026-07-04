// Phase 0 check #2: does an x402 USDC payment on Base Sepolia actually settle?
// Prereq: the mock provider must be running (`pnpm mock`) and the buyer wallet funded with test USDC.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import { pay } from "../src/pay/x402.js";

const ENDPOINT = "http://localhost:4021/holders";

async function main() {
  if (!process.env.EVM_PRIVATE_KEY) {
    console.error("✗ EVM_PRIVATE_KEY missing in .env — paste your funded wallet key first.");
    process.exit(1);
  }

  // (a) unpaid request must be rejected with 402 + PAYMENT-REQUIRED
  console.log("→ (a) unpaid GET /holders (expect 402) …");
  let okUnpaid = false;
  try {
    const res = await fetch(ENDPOINT);
    const hasHeader = [...res.headers.keys()].some((k) => k.toLowerCase().includes("payment"));
    okUnpaid = res.status === 402;
    console.log(`  status=${res.status}  payment-header=${hasHeader ? "present" : "absent"}`);
  } catch (e) {
    console.error("  ✗ could not reach mock provider — is it running? (`pnpm mock`)", (e as Error).message);
    process.exit(1);
  }

  // (b) paid request must return 200 + a tx hash
  console.log("→ (b) paid GET /holders via pay() (expect 200 + tx hash) …");
  let okPaid = false;
  let txHash: string | null = null;
  try {
    const r = await pay({ endpoint: ENDPOINT, method: "GET", estCostAtomic: 8000 }); // $0.008
    txHash = r.txHash;
    okPaid = true;
    console.log(`  data=${JSON.stringify(r.data)}  latency=${r.latencyMs}ms`);
    console.log(`  txHash=${txHash ?? "(none — pending?)"}`);
    if (txHash) console.log(`  basescan: https://sepolia.basescan.org/tx/${txHash}`);
  } catch (e) {
    console.error("  ✗ pay() failed:", (e as Error).message);
    console.error("  → If settlement is flaky: FALLBACK to a mock facilitator (keep the 402 handshake real).");
  }

  console.log("\n=== PHASE 0 CHECK #2 ===");
  console.log(`  unpaid → 402:        ${okUnpaid ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`  paid → 200 + txHash: ${okPaid && txHash ? "PASS ✓" : okPaid ? "PARTIAL (200, no hash)" : "FAIL ✗"}`);
  process.exit(okUnpaid && okPaid && txHash ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ smoke-x402 failed:", e?.message ?? e);
  process.exit(1);
});
