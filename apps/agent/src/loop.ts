// The agent loop (docs/03) — Hybrid model, console-only for Phase 2.
// The LLM PROPOSES tool calls; deterministic guardrails DISPOSE; pay() (sole signer) EXECUTES.
// Verify is stubbed (Phase 3 wires the real judge + memory EMA + provider ranking).
import OpenAI from "openai";
import { maxPriceForCapability } from "@thinkpay/shared";
import type { Decision, RunConfig, RunTotals } from "@thinkpay/shared";
import { chatTurn, compose, plan, verify } from "./btl";
import { TOOL_TO_CAPABILITY, buildToolCall, isPaidTool, type ToolCall } from "./tools";
import { chooseProvider, update } from "./memory";
import { callKey, evaluate, type PaidRequest, type RunState } from "./guardrails";
import { writeDecision, updateDecision, type RunRecord } from "./ledger";
import { pay, PaymentError } from "./pay/x402";
import { newId } from "./ids";

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MAX_TURNS = 12;
const MAX_NO_PROGRESS = 3;
const INNER_TURNS_PER_SUBGOAL = 3;

const SYSTEM =
  "You are an on-chain research agent with paid tools (holders, liquidity, audit) that cost real money over x402. " +
  "For each sub-goal, call the single appropriate paid tool, OR call `answer` (FREE) if you can already answer. " +
  "Prefer restraint: never pay when reasoning or prior results suffice. Make one tool call at a time.";

export interface LoopResult {
  totals: RunTotals;
  report: string;
}

function functionCalls(msg: OpenAI.Chat.Completions.ChatCompletionMessage): ToolCall[] {
  return (msg.tool_calls ?? [])
    .filter((tc): tc is Extract<typeof tc, { type: "function" }> => tc.type === "function")
    .map((tc) => ({ id: tc.id, function: { name: tc.function.name, arguments: tc.function.arguments } }));
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function runLoop(run: RunRecord, config: RunConfig): Promise<LoopResult> {
  const state: RunState = {
    budgetAtomic: run.budgetAtomic,
    spentAtomic: 0,
    perCallLimitAtomic: run.perCallLimitAtomic,
    paidCalls: new Map<string, unknown>(),
    noProgressStreak: 0,
    turn: 0,
    maxTurns: MAX_TURNS,
    maxNoProgress: MAX_NO_PROGRESS,
  };

  let reasoningMicros = 0;
  let savedByCacheAtomic = 0;
  let calls = 0;
  let rejections = 0;
  let escalations = 0;
  const verifiedResults: string[] = [];

  const { subGoals, costMicros: planMicros } = await plan(config.task);
  reasoningMicros += planMicros;
  console.log(`\n▸ plan: ${subGoals.length} sub-goals`);
  for (const sg of subGoals) console.log(`   - [${sg.capability ?? "free"}] ${sg.text}`);

  const messages: Msg[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Overall task: ${config.task}` },
  ];

  for (const subGoal of subGoals) {
    if (state.turn >= state.maxTurns) {
      console.log("■ iteration backstop reached — stopping.");
      break;
    }
    if (state.noProgressStreak >= state.maxNoProgress) {
      console.log("■ no-progress streak — stopping.");
      break;
    }

    messages.push({ role: "user", content: `Sub-goal: ${subGoal.text}` });

    let answered = false;
    for (let inner = 0; inner < INNER_TURNS_PER_SUBGOAL && !answered; inner++) {
      state.turn++;
      const { msg, costMicros } = await chatTurn(messages);
      reasoningMicros += costMicros;
      messages.push(msg as Msg);

      const toolCalls = functionCalls(msg);
      if (toolCalls.length === 0) break; // model produced prose → treat as answered

      for (const tc of toolCalls) {
        const name = tc.function.name;

        // FREE exit
        if (name === "answer") {
          const summary = String(parseArgs(tc.function.arguments).summary ?? "");
          if (summary) verifiedResults.push(`- ${subGoal.text}: ${summary}`);
          answered = true;
          messages.push({ role: "tool", tool_call_id: tc.id, content: "ok" });
          continue;
        }
        if (!isPaidTool(name)) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: `unknown tool: ${name}` });
          continue;
        }

        const capability = TOOL_TO_CAPABILITY[name];
        const provider = chooseProvider(capability);
        const req: PaidRequest = buildToolCall(provider, subGoal, tc);
        const decisionId = newId();
        const base: Decision = {
          id: decisionId,
          runId: run.runId,
          subGoal: subGoal.text,
          provider: provider.endpoint,
          providerName: provider.name,
          capability,
          estCostAtomic: req.estCostAtomic,
          paidCostAtomic: null,
          guardrail: "pay",
          guardrailReason: null,
          verifyOk: null,
          verifyReason: null,
          txHash: null,
          savedAtomic: 0,
          createdAt: Date.now(),
        };

        let gate = evaluate(req, state);
        let toolReply: string;

        if (gate.action === "use_cache") {
          const cached = state.paidCalls.get(gate.cachedKey);
          savedByCacheAtomic += req.estCostAtomic;
          writeDecision({
            ...base,
            guardrail: "use_cache",
            savedAtomic: req.estCostAtomic,
            verifyOk: true,
            verifyReason: "served from cache (already paid this run)",
          });
          console.log(`   ↩ use_cache  ${provider.name} (${capability})  saved ${req.estCostAtomic}`);
          toolReply = JSON.stringify(cached ?? {});
          messages.push({ role: "tool", tool_call_id: tc.id, content: toolReply });
          continue;
        }

        if (gate.action === "block") {
          rejections++;
          writeDecision({ ...base, guardrail: "block", guardrailReason: gate.reason });
          console.log(`   ✗ block  ${provider.name} (${capability})  — ${gate.reason}`);
          messages.push({ role: "tool", tool_call_id: tc.id, content: `blocked: ${gate.reason}` });
          continue;
        }

        let escalated = false;
        if (gate.action === "escalate") {
          escalations++;
          // Mint + persist the pending row BEFORE resolving (Phase 4 streams it and awaits a human).
          writeDecision({ ...base, guardrail: "pending", guardrailReason: gate.reason });
          console.log(`   ⚑ escalate ${provider.name} (${capability}) — ${gate.reason}  → console auto-approve`);
          // Console mode has no human approver → auto-approve (Phases.md line 33). Budget STILL enforced.
          req.approved = true;
          gate = evaluate(req, state);
          escalated = true;
          if (gate.action !== "pay") {
            const reason = gate.action === "block" ? gate.reason : "not payable after approval";
            rejections++;
            updateDecision(decisionId, { guardrail: "block", guardrailReason: reason });
            console.log(`   ✗ block (post-approval)  — ${reason}`);
            messages.push({ role: "tool", tool_call_id: tc.id, content: `blocked: ${reason}` });
            continue;
          }
        }

        // gate.action === "pay"
        try {
          const result = await pay(req);
          state.spentAtomic += result.costAtomic;
          state.paidCalls.set(callKey(req.endpoint, req.args), result.data);
          calls++;

          const verdict = await verify(subGoal.text, JSON.stringify(result.data));
          // Learn from this paid outcome (EMA accuracy + cost/latency means). A verify=false
          // verdict drops the provider's accuracy so ranking demotes/floors it on the warm run.
          update(provider.endpoint, { costAtomic: result.costAtomic, latencyMs: result.latencyMs, ok: verdict.ok });
          const paidPatch = {
            guardrail: "pay" as const,
            paidCostAtomic: result.costAtomic,
            txHash: result.txHash,
            verifyOk: verdict.ok,
            verifyReason: verdict.reason,
          };
          if (escalated) updateDecision(decisionId, paidPatch);
          else writeDecision({ ...base, ...paidPatch });

          console.log(
            `   ${verdict.ok ? "✓" : "✗"} pay  ${provider.name} (${capability})  cost ${result.costAtomic}` +
              `  tx ${result.txHash ?? "(pending)"}  verify=${verdict.ok}`,
          );

          if (verdict.ok) {
            verifiedResults.push(`- ${subGoal.text}: ${JSON.stringify(result.data)}`);
            state.noProgressStreak = 0;
            toolReply = JSON.stringify(result.data);
          } else {
            state.noProgressStreak++;
            rejections++;
            toolReply = "result rejected by verify";
          }
        } catch (e) {
          // A failed (4xx/5xx) paid request does NOT charge the wallet. Record, don't crash.
          const msgText = e instanceof PaymentError ? e.message : (e as Error).message;
          rejections++;
          state.noProgressStreak++;
          const patch = { guardrail: "block" as const, guardrailReason: `payment error: ${msgText}` };
          if (escalated) updateDecision(decisionId, patch);
          else writeDecision({ ...base, ...patch });
          console.log(`   ✗ payment error  ${provider.name} (${capability}) — ${msgText}`);
          toolReply = `payment failed: ${msgText}`;
        }

        messages.push({ role: "tool", tool_call_id: tc.id, content: toolReply });
      }
    }
  }

  const { text: report, costMicros: composeMicros } = await compose(config.task, verifiedResults);
  reasoningMicros += composeMicros;

  // "Saved by memory" (docs/05): deterministic post-hoc baseline − actual tool spend. The baseline is
  // a naive agent paying the MOST EXPENSIVE catalog provider once per sub-goal (no dedupe, no skip).
  const baselineAtomic = subGoals.reduce(
    (sum, sg) => sum + (sg.capability ? maxPriceForCapability(sg.capability) : 0),
    0,
  );
  const savedByMemoryAtomic = Math.max(0, baselineAtomic - state.spentAtomic);

  const totals: RunTotals = {
    reasoningMicros,
    toolAtomic: state.spentAtomic,
    savedByCacheAtomic,
    savedByMemoryAtomic,
    calls,
    rejections,
    escalations,
  };
  return { totals, report };
}
