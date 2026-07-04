// Capability tools exposed to the LLM (docs/03). The model does NOT call providers
// directly — it calls tools named 1:1 after the capabilities. The loop maps
// tool.name → capability → provider → guardrails → pay. "answer" is the free exit.
import type { Capability, ProviderStat, SubGoal } from "@thinkpay/shared";
import type { PaidRequest } from "./guardrails";

export const TOOL_TO_CAPABILITY = {
  get_holders: "holders",
  get_liquidity: "liquidity",
  audit_contract: "audit",
} as const; // "answer" is intentionally absent — it is the free exit, not a capability

export type PaidToolName = keyof typeof TOOL_TO_CAPABILITY;

export const isPaidTool = (name: string): name is PaidToolName =>
  Object.prototype.hasOwnProperty.call(TOOL_TO_CAPABILITY, name);

const paidTool = (name: string, desc: string, props: Record<string, unknown>, required: string[]) => ({
  type: "function" as const,
  function: {
    name,
    description: desc + " Costs money (paid x402 tool).",
    parameters: { type: "object", properties: props, required },
  },
});

export const tools = [
  paidTool("get_holders", "Holder distribution for a token by address/symbol.", { query: { type: "string" } }, ["query"]),
  paidTool("get_liquidity", "Liquidity / TVL snapshot for a token.", { query: { type: "string" } }, ["query"]),
  paidTool("audit_contract", "Security scan of a smart contract by address.", { address: { type: "string" } }, ["address"]),
  {
    type: "function" as const,
    function: {
      name: "answer",
      description:
        "Finish the current sub-goal from information already gathered. FREE — prefer this whenever the sub-goal can be answered without paying.",
      parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
    },
  },
];

/** The shape of a single OpenAI tool call we consume. */
export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

/**
 * Produces the PaidRequest the guardrails and pay() consume.
 * estCostAtomic is ALWAYS the catalog price of the chosen provider — never 0.
 * args are parsed from the tool call and used only for the dedupe hash (mock endpoints are argless GETs).
 */
export function buildToolCall(provider: ProviderStat, _subGoal: SubGoal, toolCall: ToolCall): PaidRequest {
  let args: unknown = {};
  try {
    args = JSON.parse(toolCall.function.arguments || "{}");
  } catch {
    args = {};
  }
  return {
    endpoint: provider.endpoint,
    method: "GET", // mock endpoints are argless GETs; args are for hashing/dedupe
    args,
    estCostAtomic: provider.priceAtomic,
  };
}

export const capabilityForTool = (name: PaidToolName): Capability => TOOL_TO_CAPABILITY[name];
