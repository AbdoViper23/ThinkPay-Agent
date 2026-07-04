# 04 — Frontend (`apps/web`)

The dashboard's only job on demo day: make the agent's **judgment about money visible in real time**, and make the cold-run vs warm-run difference undeniable. It is a read-only live view plus minimal run controls.

## Stack

Next.js (App Router) + Tailwind + Recharts. Connects to the agent over SSE (`GET :3001/run/:runId/stream`). No auth, no persistence in the browser (all state comes from the agent). Keep it a single screen.

## Screens / regions (one page)

```
┌───────────────────────────────────────────────────────────────────────┐
│  THINKPAY            [ task input ........................ ] [ Budget $  ] │
│  a spending conscience for agents                       [ Per-call $ ]  │
│                                                         [  Run  ]       │
├──────────────────────────────┬────────────────────────────────────────┤
│  SPEND METER                  │   LEDGER FEED (live, streaming)          │
│  ┌────────────────────────┐   │   ● plan: 3 sub-goals                    │
│  │ $0.098 / $0.25          │   │   ● holders → Provider A  pay $0.008 ✓   │
│  │ ▓▓▓▓▓▓░░░░░░░░░░ 39%     │   │   ● liquidity → Provider B pay $0.012 ✗  │
│  └────────────────────────┘   │       rejected: off-topic, not used      │
│  Reasoning (BTL): $0.010      │   ● liquidity → Provider C pay $0.010 ✓   │
│  Tools (x402):    $0.088      │   ● duplicate blocked  −$0.010 saved      │
│  Saved by memory: $0.048      │   ● audit → $0.06  ⚠ escalated [Approve]  │
├──────────────────────────────┴────────────────────────────────────────┤
│  PROVIDER MEMORY                                                        │
│  Provider   Capability   Avg cost  Latency  Accuracy  Uses  Rank        │
│  A          holders      $0.008    1.2s     0.98      5     ★ best       │
│  C          liquidity     $0.010    0.9s     0.95      3     ★ best       │
│  B          liquidity     $0.012    2.1s     0.40      2     avoid        │
└───────────────────────────────────────────────────────────────────────┘
```

## Components

- **RunControls** — task textarea, budget + per-call number inputs, Run button. On submit → `POST /run`, then open the SSE stream for the returned `runId`.
- **SpendMeter** — the hero. The bar measures **tool (x402) spend vs the budget** — that is exactly what the guardrails cap (`budgetAtomic` is tool-only, see `03`), so the bar and the enforced cap agree. **Reasoning (BTL) cost is shown as a second figure beside the bar, not inside it** — it is the dual ledger, tracked and displayed but never subtracted from the budget. Plus a bold **"Saved by memory"** figure that animates up on the warm run. This is the emotional center; give it the most visual weight. (Don't render a single `$0.098/$0.25` bar that mixes reasoning+tools against the budget — reasoning can never trip that cap, so it would misrepresent what's measured.)
- **LedgerFeed** — the live stream. Each decision animates in as an SSE `decision` event arrives. Encode outcome by **structure and state, not just color**: paid ✓, rejected ✗ (struck-through, "not used"), duplicate blocked (with the saved amount), escalated (with an inline **Approve / Deny** control that calls `POST /approve`). Show the tx hash as a short monospace link when present.
- **ProviderTable** — the memory. Sortable by rank. The known-bad provider (low accuracy) should be visually demoted so the audience sees *why* the warm run skips it.
- **RunCompare** (optional, high payoff) — after two runs, a tiny two-bar chart: cold $ vs warm $. If time is short, the animated "Saved by memory" number carries this alone.

## Live wiring

```ts
const es = new EventSource(`http://localhost:3001/run/${runId}/stream`);
es.addEventListener("status",         (e) => setStatus(JSON.parse(e.data)));
es.addEventListener("decision",       (e) => appendDecision(JSON.parse(e.data)));       // new row
es.addEventListener("decision:update",(e) => updateDecision(JSON.parse(e.data)));       // by id: pending → paid/blocked
es.addEventListener("escalation",     (e) => markPending(JSON.parse(e.data)));          // { decisionId, reason }
es.addEventListener("done",           (e) => { setTotals(JSON.parse(e.data)); es.close(); refetchProviders(); });

// Approve/Deny → the EXACT backend contract (path carries runId; body carries decisionId + approve):
async function respondEscalation(runId: string, decisionId: string, approve: boolean) {
  await fetch(`http://localhost:3001/run/${runId}/approve`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decisionId, approve }),
  });
}

// ProviderTable has NO SSE channel — pull it:
async function refetchProviders() { setProviders(await (await fetch("http://localhost:3001/providers")).json()); }
```

- **Units on the wire:** every money field in an SSE payload is an **integer atomic USDC unit (6 dp)**. Format at the edge with `formatUsd` from `packages/shared` — do not do float math in the browser.
- **ProviderTable data source:** `GET /providers` (there is no provider SSE event). Call it on mount, after each `done`, and specifically after the cold run so the audience sees the bad provider demoted before the warm run.
- The stream **replays** already-persisted decisions on connect, so opening the `EventSource` a beat after `POST /run` won't drop early rows.
- Backend must send `cors({ origin: "http://localhost:3000" })` or none of this connects (`03`).

Render decisions progressively; never block the page waiting for the run to finish.

## Design direction (make it not look templated)

The subject is **money under judgment** — a control room / ledger, not a generic SaaS dashboard. Deliberate choices:

- **Palette:** an "ink on ledger paper" base — a cool near-black ink (`#12131A`), a warm off-white panel (`#F5F2EA`), a restrained brass/gold for money-in-motion (`#B08D3F`), a muted green for verified (`#2F6D4F`), a muted rust for rejected/blocked (`#9B4A38`). Spend the one bold accent (brass) only on money movement.
- **Type:** a characterful monospace for all numbers, tx hashes, and the ledger (money is tabular data and should read like a ledger); a clean grotesque for labels/headings. Tabular-figure alignment on every dollar amount.
- **Structure:** the ledger feed *is* a real chronological sequence, so timestamps/ordering carry meaning — lean into that. Avoid decorative 01/02/03 markers elsewhere.
- **Motion:** one orchestrated moment — a decision row settling into the ledger with the amount ticking, and the "Saved by memory" figure counting up on the warm run. Respect `prefers-reduced-motion`. Keep everything else still.

Avoid the current AI-default looks: cream + serif + terracotta (`#D97757`), near-black + acid-green, or broadsheet hairline columns. Pick the ledger identity above and execute it precisely.

## Quality floor

Responsive to a laptop screen-share resolution, visible keyboard focus, reduced-motion honored. Empty state before the first run is an invitation: "Give the agent a task and a budget. Watch it decide what's worth paying for." Errors speak plainly in the interface's voice ("Payment failed on Base Sepolia — wallet not funded", not a stack trace).
