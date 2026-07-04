// The BRAIN — BTL Runtime via the OpenAI SDK (base-URL swap). docs/06.
// Never touches wallets, keys, or x402. Emits decisions (tool calls) only.
import OpenAI from "openai";
import type { Capability, SubGoal } from "@thinkpay/shared";
import { newId } from "./ids";
import { tools } from "./tools";

const REASONING_MODEL = "btl-2";
// A cheaper judge model for Phase 3's verify. Kept here so the stub and the real judge share config.
export const JUDGE_MODEL = "gpt-4.1-mini";

let client: OpenAI | null = null;
function btl(): OpenAI {
  if (!client) {
    const apiKey = process.env.GATEWAY_API_KEY;
    if (!apiKey) throw new Error("GATEWAY_API_KEY missing in .env — required for BTL Runtime calls.");
    client = new OpenAI({ apiKey, baseURL: "https://api.badtheorylabs.com/v1" });
  }
  return client;
}

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type Assistant = OpenAI.Chat.Completions.ChatCompletionMessage;

/** Reasoning cost of a single BTL response, in integer micro-dollars (1e-6 USD = atomic USDC scale). */
function micros(response: Response): number {
  return Math.round(Number(response.headers.get("x-btl-customer-charge") ?? 0) * 1e6);
}

const CAPS: readonly (Capability | null)[] = ["holders", "liquidity", "audit", null];
function coerceCapability(v: unknown): Capability | null {
  return CAPS.includes(v as Capability | null) ? (v as Capability | null) : null;
}

function stripFence(s: string): string {
  return s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

const PLAN_SYSTEM =
  "You are a planning module for an on-chain research agent. Decompose the task into 1-4 ordered sub-goals. " +
  "Tag each sub-goal with the paid capability it needs: 'holders', 'liquidity', or 'audit'; use null if it can be " +
  "answered from reasoning alone (no paid tool). Reply ONLY compact JSON, no prose.";

const PLAN_USER = (task: string) =>
  `Task: ${task}\n\nReply JSON exactly: {"subGoals":[{"text": string, "capability": "holders"|"liquidity"|"audit"|null}]}`;

/** Canned plan for reproducible demos (DEMO=1). Includes a duplicate holders sub-goal to exercise dedupe. */
function cannedPlan(): SubGoal[] {
  return [
    { id: newId(), text: "Holder distribution for token XYZ", capability: "holders" },
    { id: newId(), text: "Liquidity depth for token XYZ", capability: "liquidity" },
    { id: newId(), text: "Contract security check for token XYZ", capability: "audit" },
    { id: newId(), text: "Re-confirm holder distribution for token XYZ", capability: "holders" },
  ];
}

function parsePlan(content: string): SubGoal[] {
  const raw = JSON.parse(stripFence(content)) as { subGoals?: Array<{ text?: unknown; capability?: unknown }> };
  const list = Array.isArray(raw.subGoals) ? raw.subGoals : [];
  const subGoals = list
    .filter((s) => typeof s.text === "string" && (s.text as string).trim().length > 0)
    .map((s) => ({ id: newId(), text: String(s.text), capability: coerceCapability(s.capability) }));
  if (subGoals.length === 0) throw new Error("plan returned no valid sub-goals");
  return subGoals;
}

/** Decompose a task into capability-tagged sub-goals. */
export async function plan(task: string): Promise<{ subGoals: SubGoal[]; costMicros: number }> {
  if (process.env.DEMO === "1") return { subGoals: cannedPlan(), costMicros: 0 };

  let costMicros = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, response } = await btl()
      .chat.completions.create({
        model: REASONING_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PLAN_SYSTEM },
          { role: "user", content: PLAN_USER(task) },
        ],
      })
      .withResponse();
    costMicros += micros(response);
    const content = data.choices[0]?.message?.content ?? "";
    try {
      return { subGoals: parsePlan(content), costMicros };
    } catch (e) {
      if (attempt === 1) throw new Error(`plan() failed to parse strict JSON: ${(e as Error).message}`);
    }
  }
  throw new Error("plan() unreachable");
}

/** One tool-choosing round. The model either calls `answer` (free) or a paid capability tool. */
export async function chatTurn(messages: Msg[]): Promise<{ msg: Assistant; costMicros: number }> {
  const { data, response } = await btl()
    .chat.completions.create({
      model: REASONING_MODEL,
      temperature: 0.2,
      tool_choice: "auto",
      tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
      messages,
    })
    .withResponse();
  const msg = data.choices[0]?.message;
  if (!msg) throw new Error("BTL returned no message");
  return { msg, costMicros: micros(response) };
}

/** Final report from the verified results. */
export async function compose(task: string, results: string[]): Promise<{ text: string; costMicros: number }> {
  const { data, response } = await btl()
    .chat.completions.create({
      model: REASONING_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Summarize the findings for the task in a short, factual report. Cite the data you were given." },
        { role: "user", content: `Task: ${task}\n\nVerified findings:\n${results.join("\n") || "(none)"}` },
      ],
    })
    .withResponse();
  return { text: data.choices[0]?.message?.content ?? "", costMicros: micros(response) };
}

/**
 * Verify judge — Phase 2 STUB. Always passes.
 * Phase 3 swaps this body for a real `btlJudge` (JUDGE_MODEL, temperature 0, strict JSON).
 * Signature is intentionally the final one so the loop never changes.
 */
export async function verify(_subGoal: string, _response: string): Promise<{ ok: boolean; reason: string }> {
  return { ok: true, reason: "verify stubbed (Phase 3)" };
}
