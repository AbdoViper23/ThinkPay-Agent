# 06 — BTL Runtime Integration (`apps/agent/src/btl.ts`)

BTL Runtime is the **brain only** — an OpenAI-compatible inference gateway. It does routing, caching, and cost visibility. It does **not** touch wallets, x402, or money. Feasibility for us reduces to one thing: it passes the OpenAI `tools` parameter through to tool-capable models. It does (it routes to models like `btl-2`, `gpt-4.1-mini`, Claude, etc.).

## Client setup

```ts
import OpenAI from "openai";

export const btl = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY,           // scoped machine key from the BTL dashboard
  baseURL: "https://api.badtheorylabs.com/v1",   // the ONLY change vs vanilla OpenAI
});
```

Verified from BTL docs: same OpenAI SDK, same call shapes, swap the base URL. A curl smoke test returns `200` with cost headers.

## Models

- **Reasoning / planning / compose:** `model: "btl-2"` — BTL's smart multi-provider router. Good default; it picks a capable provider under the hood.
- **Verify judge:** use a cheaper model slug (e.g. `gpt-4.1-mini`) at `temperature: 0`. The judge is called once per paid result, so keep it cheap.

## Reasoning + tool-calling call

```ts
const res = await btl.chat.completions.create({
  model: "btl-2",
  messages,                 // system + running conversation
  tools,                    // from src/tools.ts (OpenAI function-calling format)
  tool_choice: "auto",
  temperature: 0.2,
});
const msg = res.choices[0].message;
const toolCalls = msg.tool_calls ?? [];   // each: { id, type:"function", function: { name, arguments } }
```

Standard OpenAI loop: read `tool_calls`, execute (through the guardrail gate + `pay`), append the tool result, call again. This is exactly the pattern the loop in `03-BACKEND.md` implements. **Two mandatory details the SDK enforces (both return a 400 and break the loop if wrong):**

1. `toolCall.function.arguments` is a **JSON string**, not an object — `JSON.parse` it before use.
2. Every tool result must be a message of the form `{ role: "tool", tool_call_id: toolCall.id, content: <string> }`. The `tool_call_id` must match the assistant's `tool_calls[].id`, and after an assistant turn with `tool_calls` you must append **one** tool message per call before the next `create()`.

```ts
// append the assistant turn, then one tool reply per call, then loop
messages.push(msg);
for (const tc of toolCalls) {
  const args = JSON.parse(tc.function.arguments);          // (1) parse the string
  const result = await executeThroughGuardrails(tc, args); // gate + pay + verify (see 03)
  messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) }); // (2)
}
```

## Verify judge

```ts
export async function btlJudge(input: { subGoal: string; response: string }) {
  const r = await btl.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages: [
      { role: "system", content: "You are a strict QA judge. Answer only compact JSON." },
      { role: "user", content:
        `Sub-goal: ${input.subGoal}\n\nResponse to judge:\n${input.response}\n\n` +
        `Did the response actually satisfy the sub-goal? Reply JSON: {"ok": boolean, "reason": string}` }
    ],
  });
  return JSON.parse(r.choices[0].message.content!) as { ok: boolean; reason: string };
}
```

## Cost visibility (the reasoning ledger)

Every response carries headers you should read and record per call:

```
x-btl-request-id       req_8f2a1c9d
x-btl-cache-tier       exact_response_cache
x-btl-benchmark-cost   0.014     # what the direct provider would have cost ($)
x-btl-customer-charge  0.0056    # what BTL charged you ($)
x-btl-saved            0.0084    # savings ($)
```

With the OpenAI SDK, read raw headers via `.withResponse()`:

```ts
const { data, response } = await btl.chat.completions
  .create({ model: "btl-2", messages }).withResponse();
const charge = Number(response.headers.get("x-btl-customer-charge") ?? 0);
runState.reasoningCostMicros += Math.round(charge * 1e6);   // ROUND — keep the integer column integer
```

- **Wrap EVERY BTL call with `.withResponse()`** — `plan`, each per-sub-goal tool-choosing turn, the `verify` judge, and `compose`. The verify judge runs once per paid result and is a real reasoning cost; if you only instrument the main `create()` you silently undercount the reasoning ledger the demo highlights.
- **Round to integer micros** (`Math.round(charge * 1e6)`) before adding to `runs.reasoningCostMicros` — micro-dollars are the same 1e-6 USD scale as atomic USDC, so `reasoningCostMicros + spentToolsAtomic` is a valid sum for the meter (`03`, `04`).
- **Do not use `GET /v1/usage/summary` for the per-run `done` total** — it is workspace-cumulative across all runs, so it over-reports a single run. Use the accumulated per-call charges. (`/v1/usage/summary` is fine only as a separate workspace-level figure.)
- If `x-btl-customer-charge` is absent, `headers.get()` returns `null` and `?? 0` records `$0` — degrades the cost ledger silently but does not crash. Confirm the exact header names in the hour-1 smoke test.

## Gotchas

- **Caching in an agent loop.** BTL caches (`exact_response_cache`). Identical `messages` can return a cached completion. In our loop each turn appends new tool results, so message arrays differ turn-to-turn and this is a non-issue — but do **not** send byte-identical requests expecting fresh decisions. If you ever need to force a miss, vary a nonce in the system message.
- **Tool passthrough — smoke-test in hour 1.** Send one `tools` request and confirm `tool_calls` come back intact. It works because BTL routes to tool-capable models, but verify early rather than discovering a surprise at hour 30.
- **Free credits are a launch promo with rate limits.** Don't architect around unlimited free inference; keep verify cheap and avoid needless calls (which is on-thesis anyway).
- **JSON reliability.** For `plan`/`verify`, instruct strict JSON and parse defensively (strip stray prose/backticks). Consider `response_format: { type: "json_object" }` if the routed model supports it; otherwise validate and retry once.

## Env

```
GATEWAY_API_KEY=btl_...        # from the BTL dashboard, "inference" scope
```
