// Phase 0 check #1: does BTL Runtime return native tool_calls + cost headers?
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import OpenAI from "openai";

const apiKey = process.env.GATEWAY_API_KEY;
if (!apiKey) {
  console.error("✗ GATEWAY_API_KEY missing in .env — paste the BTL key first, then re-run.");
  process.exit(1);
}

const btl = new OpenAI({ apiKey, baseURL: "https://api.badtheorylabs.com/v1" });

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_holders",
      description: "Holder distribution for a token by address/symbol. Costs money (paid x402 tool).",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "token address or symbol" } },
        required: ["query"],
      },
    },
  },
];

async function main() {
  console.log("→ calling btl-2 with a dummy tools array …");
  const { data, response } = await btl.chat.completions
    .create({
      model: "btl-2",
      messages: [
        { role: "system", content: "You can call tools. When asked about a token's holders, call get_holders." },
        { role: "user", content: "How are the holders distributed for token 0xABC? Use your tools." },
      ],
      tools,
      tool_choice: "auto",
      temperature: 0.2,
    })
    .withResponse();

  const msg = data.choices[0]?.message;
  const toolCalls = msg?.tool_calls ?? [];

  console.log("\n=== headers ===");
  for (const h of ["x-btl-request-id", "x-btl-cache-tier", "x-btl-benchmark-cost", "x-btl-customer-charge", "x-btl-saved"]) {
    console.log(`  ${h}: ${response.headers.get(h) ?? "(absent)"}`);
  }

  console.log("\n=== tool_calls ===");
  if (toolCalls.length === 0) {
    console.log("  (none — model returned prose)");
    console.log(`  content: ${msg?.content ?? ""}`);
  }
  for (const tc of toolCalls) {
    const fn = (tc as { function?: { name: string; arguments: string } }).function;
    let parsed: unknown = "(unparseable)";
    try {
      parsed = JSON.parse(fn?.arguments ?? "");
    } catch {
      /* leave marker */
    }
    console.log(`  ${fn?.name}  args=${JSON.stringify(parsed)}`);
  }

  const charge = response.headers.get("x-btl-customer-charge");
  const okTools = toolCalls.length > 0;
  const okCharge = charge != null && charge !== "";

  console.log("\n=== PHASE 0 CHECK #1 ===");
  console.log(`  tool_calls present:        ${okTools ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`  x-btl-customer-charge set: ${okCharge ? `PASS ✓ (${charge})` : "FAIL ✗ (absent)"}`);
  if (!okTools) console.log("  → FALLBACK: switch the loop to JSON-mode prompting (response_format) instead of native tools.");
  process.exit(okTools ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ smoke-btl failed:", e?.message ?? e);
  process.exit(1);
});
