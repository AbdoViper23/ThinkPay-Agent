"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Ban,
  Brain,
  CircleDollarSign,
  Eye,
  Fingerprint,
  Gauge,
  Github,
  Hand,
  Lock,
  Repeat,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#12131A] font-sans">
      <Nav />
      <Hero />
      <Marquee />
      <Problem />
      <Insight />
      <Architecture />
      <Runtime />
      <Guardrails />
      <DemoStrip />
      <Halal />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#12131A]/10 bg-[#F5F2EA]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <LedgerMark />
          <span className="text-[15px] font-semibold tracking-tight">ThinkPay</span>
          <span className="ml-1 hidden text-[11px] uppercase tracking-[0.18em] text-[#12131A]/50 sm:inline">
            Ledger
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#12131A]/70 md:flex">
          <a href="#problem" className="hover:text-[#12131A]">Problem</a>
          <a href="#architecture" className="hover:text-[#12131A]">Architecture</a>
          <a href="#runtime" className="hover:text-[#12131A]">BTL Runtime</a>
          <a href="#guardrails" className="hover:text-[#12131A]">Guardrails</a>
        </nav>
        <Link
          href="/app"
          className="group inline-flex items-center gap-2 rounded-full bg-[#12131A] px-4 py-2 text-[13px] font-medium text-[#F5F2EA] transition-all hover:bg-[#12131A]/90"
        >
          Launch app
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}

function LedgerMark() {
  return (
    <span className="relative flex h-8 w-8 items-center justify-center rounded-md border border-[#12131A]/20 bg-[#12131A]">
      <Scale className="h-4 w-4 text-[#B08D3F]" strokeWidth={1.5} />
    </span>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28">
        <div className="relative">
          <div className="anim-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[#12131A]/15 bg-white/60 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#12131A]/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F6D4F] anim-tick" />
            BTL Runtime Hackathon · Base Sepolia
          </div>
          <h1 className="anim-fade-up font-serif-display text-[56px] leading-[1.02] tracking-tight text-[#12131A] sm:text-[68px] lg:text-[84px]">
            An agent that spends money is only useful if it has the{" "}
            <em className="italic text-[#B08D3F]">judgment</em> not to.
          </h1>
          <p
            className="anim-fade-up mt-8 max-w-xl text-[17px] leading-relaxed text-[#12131A]/70"
            style={{ animationDelay: "120ms" }}
          >
            ThinkPay is a deterministic control plane that sits between an agent's reasoning
            and its wallet. It decides whether a paid API call is worth it, remembers which
            providers were cheap and honest, verifies every paid result, and hard-stops
            runaway spend — on the BTL Runtime, over x402.
          </p>
          <div
            className="anim-fade-up mt-10 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-full bg-[#12131A] px-6 py-3.5 text-sm font-medium text-[#F5F2EA] transition-all hover:bg-[#12131A]/90"
            >
              Open the ledger
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 rounded-full border border-[#12131A]/25 bg-transparent px-6 py-3.5 text-sm font-medium text-[#12131A] transition-all hover:border-[#12131A] hover:bg-[#12131A]/5"
            >
              How it works
            </a>
          </div>

          <div
            className="anim-fade-up mt-16 grid grid-cols-3 gap-4 border-t border-[#12131A]/10 pt-8"
            style={{ animationDelay: "360ms" }}
          >
            <Stat kpi="12 / 12" label="Guardrail tests passing" />
            <Stat kpi="2 ledgers" label="Reasoning + tools, one screen" />
            <Stat kpi="Non-custodial" label="Spot USDC. No leverage." />
          </div>
        </div>

        <HeroArt />
      </div>
    </section>
  );
}

function Stat({ kpi, label }: { kpi: string; label: string }) {
  return (
    <div>
      <div className="font-mono-num text-2xl font-medium text-[#12131A]">{kpi}</div>
      <div className="mt-1 text-[12px] uppercase tracking-[0.14em] text-[#12131A]/55">
        {label}
      </div>
    </div>
  );
}

function HeroArt() {
  return (
    <div className="relative aspect-square w-full max-w-[560px] justify-self-center overflow-hidden rounded-2xl border border-[#12131A]/15 bg-[#12131A] text-[#F5F2EA] shadow-[0_40px_80px_-30px_rgba(18,19,26,0.5)]">
      {/* orbits */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="anim-orbit-slow absolute h-[110%] w-[110%] rounded-full border border-dotted border-[#F5F2EA]/12" />
        <div className="anim-orbit-med absolute h-[85%] w-[85%] rounded-full border border-dotted border-[#F5F2EA]/18" />
        <div className="anim-orbit-fast absolute h-[60%] w-[60%] rounded-full border border-dashed border-[#B08D3F]/40" />
        <div className="absolute h-14 w-14 rounded-full bg-[#B08D3F] shadow-[0_0_60px_20px_rgba(176,141,63,0.35)]" />
      </div>

      {/* corner labels */}
      <div className="pointer-events-none absolute inset-0 p-6 font-mono-num text-[10px] uppercase tracking-[0.18em] text-[#F5F2EA]/60">
        <div className="absolute left-6 top-6 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2F6D4F] anim-tick" />
          live · base sepolia
        </div>
        <div className="absolute right-6 top-6">req_8f2a1c9d</div>
        <div className="absolute left-6 bottom-6">brain → conscience → hands</div>
        <div className="absolute right-6 bottom-6 text-[#B08D3F]">x402 · usdc</div>
      </div>

      {/* mini ledger card */}
      <div className="absolute bottom-6 left-6 right-6 rounded-lg border border-[#F5F2EA]/15 bg-[#12131A]/70 p-4 backdrop-blur">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#F5F2EA]/50">
          <span>Decision ledger</span>
          <span>cold run</span>
        </div>
        <div className="mt-3 space-y-1.5 font-mono-num text-[11.5px] text-[#F5F2EA]/85">
          <LedgerLine label="get_holders · provider A" amount="$0.008" tag="pay" tone="ok" />
          <LedgerLine label="get_liquidity · provider B" amount="$0.012" tag="dropped" tone="bad" />
          <LedgerLine label="get_liquidity · provider C" amount="$0.010" tag="pay" tone="ok" />
          <LedgerLine label="duplicate call · dedupe" amount="$0.010" tag="saved" tone="mute" />
          <LedgerLine label="audit · $0.060" amount="—" tag="escalated" tone="warn" />
        </div>
      </div>
    </div>
  );
}

function LedgerLine({
  label,
  amount,
  tag,
  tone,
}: {
  label: string;
  amount: string;
  tag: string;
  tone: "ok" | "bad" | "warn" | "mute";
}) {
  const toneClass =
    tone === "ok"
      ? "text-[#2F6D4F] border-[#2F6D4F]/40"
      : tone === "bad"
      ? "text-[#9B4A38] border-[#9B4A38]/40"
      : tone === "warn"
      ? "text-[#B08D3F] border-[#B08D3F]/40"
      : "text-[#F5F2EA]/50 border-[#F5F2EA]/20";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#F5F2EA]/8 py-1 last:border-0">
      <span className="truncate">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${toneClass}`}>
          {tag}
        </span>
        <span className="w-14 text-right tabular">{amount}</span>
      </div>
    </div>
  );
}

function Marquee() {
  const items = [
    "spot USDC only",
    "non-custodial wallet",
    "no leverage",
    "no lending",
    "no gambling",
    "no perpetuals",
    "audit trail on Base Sepolia",
    "verify judge on every paid call",
    "cross-session provider memory",
  ];
  return (
    <div className="border-y border-[#12131A]/10 bg-[#12131A] text-[#F5F2EA]">
      <div className="mx-auto flex max-w-full items-center gap-10 overflow-hidden whitespace-nowrap px-6 py-4 font-mono-num text-[11px] uppercase tracking-[0.22em] text-[#F5F2EA]/60">
        {items.concat(items).map((t, i) => (
          <span key={i} className="flex items-center gap-10">
            <span className="h-1 w-1 rounded-full bg-[#B08D3F]" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-[#12131A]/55">
        <span className="h-px w-8 bg-[#12131A]/40" />
        {eyebrow}
      </div>
      <h2 className="font-serif-display text-4xl leading-[1.05] tracking-tight text-[#12131A] sm:text-5xl lg:text-[56px]">
        {title}
      </h2>
      {lead ? <p className="mt-6 text-lg text-[#12131A]/70">{lead}</p> : null}
    </div>
  );
}

function Problem() {
  const items = [
    { icon: <CircleDollarSign className="h-4 w-4" />, t: "No spend judgment", d: "Pays for whatever it thinks it needs — no sense of worth or free paths." },
    { icon: <Ban className="h-4 w-4" />, t: "Pays for garbage", d: "APIs return off-topic data; naive agents build reasoning on junk." },
    { icon: <Repeat className="h-4 w-4" />, t: "Runaway loops", d: "Retries endlessly, burns budget, makes zero progress." },
    { icon: <Brain className="h-4 w-4" />, t: "No memory", d: "Every run starts blind. Re-discovers bad providers every time." },
    { icon: <Fingerprint className="h-4 w-4" />, t: "No accountability", d: "No auditable trace of what was bought, why, or at what cost." },
  ];
  return (
    <section id="problem" className="border-t border-[#12131A]/10">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeader
          eyebrow="The problem"
          title={
            <>
              Agents can now pay for tools. <em className="italic text-[#B08D3F]">That</em> is the problem.
            </>
          }
          lead="The moment an agent controls a wallet, a new class of failure appears that normal agent tooling doesn't handle."
        />
        <div className="mt-14 grid grid-cols-1 gap-px bg-[#12131A]/10 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((it, i) => (
            <div key={i} className="group bg-[#F5F2EA] p-6 transition-colors hover:bg-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#12131A]/15 text-[#12131A]">
                {it.icon}
              </div>
              <div className="mt-5 font-serif-display text-xl">{it.t}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#12131A]/65">{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Insight() {
  return (
    <section className="bg-[#12131A] text-[#F5F2EA]">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-[#F5F2EA]/50">
              <span className="h-px w-8 bg-[#B08D3F]" />
              The inversion
            </div>
            <h2 className="font-serif-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-[64px]">
              Most teams demo an agent that <em className="italic text-[#B08D3F]">pays</em>.
              <br />
              We demo an agent that <em className="italic text-[#B08D3F]">refuses</em> to.
            </h2>
          </div>
          <div className="space-y-4 text-[15px] leading-relaxed text-[#F5F2EA]/75">
            <p>
              ThinkPay decides <span className="text-[#F5F2EA]">not</span> to pay, remembers
              why, verifies what it bought, and proves every decision. Restraint is the
              feature. The agent's best move is often not to spend at all.
            </p>
            <p className="text-[#F5F2EA]/55">
              A spending control plane, not a payment demo.
            </p>
          </div>
        </div>

        {/* Two ledgers block */}
        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
          <LedgerCard
            title="Reasoning ledger"
            subtitle="BTL Runtime · metered"
            total="$0.014"
            rows={[
              ["plan(task)", "$0.003"],
              ["choose tool · holders", "$0.002"],
              ["choose tool · liquidity", "$0.003"],
              ["verify judge ×3", "$0.004"],
              ["compose answer", "$0.002"],
            ]}
          />
          <LedgerCard
            title="Tool ledger"
            subtitle="x402 · USDC on Base Sepolia"
            total="$0.098"
            rows={[
              ["get_holders · A", "$0.008"],
              ["get_liquidity · B (dropped)", "$0.012"],
              ["get_liquidity · C", "$0.010"],
              ["dedupe · saved", "$0.010"],
              ["audit · approved", "$0.060"],
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function LedgerCard({
  title,
  subtitle,
  total,
  rows,
}: {
  title: string;
  subtitle: string;
  total: string;
  rows: [string, string][];
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#F5F2EA]/15 bg-[#F5F2EA]/[0.03] p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#F5F2EA]/50">{title}</div>
          <div className="mt-1 text-[13px] text-[#F5F2EA]/75">{subtitle}</div>
        </div>
        <div className="font-mono-num text-3xl tabular text-[#B08D3F]">{total}</div>
      </div>
      <div className="mt-5 space-y-1 font-mono-num text-[12px]">
        {rows.map(([l, v]) => (
          <div
            key={l}
            className="flex items-center justify-between border-b border-[#F5F2EA]/8 py-1.5 text-[#F5F2EA]/80 last:border-0"
          >
            <span>{l}</span>
            <span className="tabular">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Architecture() {
  const cols = [
    {
      icon: <Brain className="h-5 w-5" />,
      name: "Brain",
      sub: "BTL Runtime (LLM)",
      body: "Emits decisions as tool calls. Plans sub-goals, chooses tools, judges results. Never sees the key. Never signs.",
      chip: "btl-2",
    },
    {
      icon: <Scale className="h-5 w-5" />,
      name: "Conscience",
      sub: "Deterministic guardrails",
      body: "Sits between brain and hands. Allow, block, or escalate — before any signature exists. Pure functions. Unit-tested.",
      chip: "5 guardrails",
    },
    {
      icon: <Hand className="h-5 w-5" />,
      name: "Hands",
      sub: "viem + x402",
      body: "Holds the key. Signs USDC via EIP-3009 on HTTP 402. Settles only on 2xx. Key never enters the model's context.",
      chip: "Base Sepolia",
    },
  ];
  return (
    <section id="architecture" className="border-t border-[#12131A]/10">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <SectionHeader
          eyebrow="Architecture"
          title={
            <>
              The LLM proposes.
              <br />
              Deterministic code <em className="italic text-[#B08D3F]">disposes</em>.
            </>
          }
          lead="Three strictly separated layers. Even if the model is prompt-injected into “pay everything,” the conscience layer refuses — because the guardrails are code, not prompt instructions."
        />

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cols.map((c, i) => (
            <div
              key={c.name}
              className="group relative overflow-hidden rounded-xl border border-[#12131A]/15 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-[#12131A]/35"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#12131A] text-[#B08D3F]">
                  {c.icon}
                </div>
                <span className="rounded-full border border-[#12131A]/20 px-2 py-0.5 font-mono-num text-[10px] uppercase tracking-[0.16em] text-[#12131A]/60">
                  {c.chip}
                </span>
              </div>
              <div className="mt-6 font-serif-display text-3xl">{c.name}</div>
              <div className="mt-1 text-[13px] uppercase tracking-[0.14em] text-[#12131A]/55">
                {c.sub}
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-[#12131A]/70">{c.body}</p>
              <div className="mt-6 font-mono-num text-[10px] uppercase tracking-[0.22em] text-[#12131A]/40">
                0{i + 1} · {c.name.toLowerCase()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#12131A]/25 bg-[#F5F2EA] p-6 text-center font-mono-num text-[12px] tracking-[0.12em] text-[#12131A]/70 sm:flex-row sm:gap-4">
          <span>Task + Budget</span>
          <Arrow />
          <span>Brain (btl-2)</span>
          <Arrow />
          <span className="text-[#B08D3F]">Conscience</span>
          <Arrow />
          <span>Hands (x402)</span>
          <Arrow />
          <span>USDC on Base Sepolia</span>
          <Arrow />
          <span>Verify + Memory</span>
        </div>
      </div>
    </section>
  );
}

function Arrow() {
  return <ArrowRight className="hidden h-3.5 w-3.5 text-[#12131A]/40 sm:block" />;
}

function Runtime() {
  return (
    <section id="runtime" className="relative overflow-hidden border-t border-[#12131A]/10 bg-[#12131A] text-[#F5F2EA]">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-[#F5F2EA]/50">
              <span className="h-px w-8 bg-[#B08D3F]" />
              BTL Runtime · load-bearing, not decorative
            </div>
            <h2 className="font-serif-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-[60px]">
              The runtime is the <em className="italic text-[#B08D3F]">brain</em> —
              and it's on the same ledger.
            </h2>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-[#F5F2EA]/75">
              We use every capability that matters — reasoning, tool-calling, multi-provider
              routing via <span className="font-mono-num text-[#B08D3F]">btl-2</span>,
              streaming, and a cheap verify judge. Every response's cost headers are read and
              posted straight to the reasoning ledger.
            </p>

            <ul className="mt-10 space-y-3 text-[14px] text-[#F5F2EA]/85">
              {[
                ["Reasoning + planning", "plan(task) → strict-JSON sub-goals"],
                ["Tool-calling", "capability-named tools; the model chooses pay or free"],
                ["Multi-provider routing", "btl-2 picks a capable provider under the hood"],
                ["Verify judge", "second, cheaper BTL model, temp 0"],
                ["Streaming", "decisions stream live to the ledger"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-start gap-3 border-b border-[#F5F2EA]/10 pb-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#B08D3F]" />
                  <div>
                    <div className="font-medium">{k}</div>
                    <div className="text-[#F5F2EA]/60">{v}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <CodeCard />
            <HeadersCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function CodeCard() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#F5F2EA]/15 bg-[#0B0C11] p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#F5F2EA]/45">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#9B4A38]/70" />
          <span className="h-2 w-2 rounded-full bg-[#B08D3F]/70" />
          <span className="h-2 w-2 rounded-full bg-[#2F6D4F]/70" />
          <span className="ml-3">client.ts</span>
        </span>
        <span>only the base URL changes</span>
      </div>
      <pre className="mt-4 overflow-x-auto font-mono-num text-[12.5px] leading-relaxed text-[#F5F2EA]/85">
{`export const btl = new OpenAI({
  apiKey:  process.env.GATEWAY_API_KEY,
  baseURL: "https://api.badtheorylabs.com/v1", // ← the only diff
});

const { data, response } = await btl.chat.completions
  .withResponse({
    model: "btl-2",
    messages,
    tools,             // get_holders, get_liquidity, audit, answer
  });

ledger.reasoning.push({
  reqId:  response.headers.get("x-btl-request-id"),
  charge: response.headers.get("x-btl-customer-charge"),
  saved:  response.headers.get("x-btl-saved"),
});`}
      </pre>
    </div>
  );
}

function HeadersCard() {
  const rows = [
    ["x-btl-request-id", "req_8f2a1c9d"],
    ["x-btl-benchmark-cost", "$0.0140"],
    ["x-btl-customer-charge", "$0.0056"],
    ["x-btl-saved", "$0.0084"],
  ];
  return (
    <div className="mt-4 rounded-xl border border-[#F5F2EA]/15 bg-[#F5F2EA]/[0.03] p-5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#F5F2EA]/45">
        <span>Cost headers · per response</span>
        <span className="text-[#B08D3F]">posted to ledger</span>
      </div>
      <div className="mt-4 space-y-1 font-mono-num text-[12px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-[#F5F2EA]/10 py-1.5">
            <span className="text-[#F5F2EA]/60">{k}</span>
            <span className="tabular text-[#F5F2EA]/90">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Guardrails() {
  const rails = [
    { i: <Gauge className="h-4 w-4" />, n: "Hard budget cap", d: "Total x402 spend ≤ budget. Checked first, never bypassed — not even by human approval." },
    { i: <ShieldCheck className="h-4 w-4" />, n: "Per-call escalation", d: "A single call over the per-call limit pauses and asks a human. No auto-pay." },
    { i: <Repeat className="h-4 w-4" />, n: "Duplicate detection", d: "Hash (endpoint + normalized args). If already paid this run, cache — don't pay twice." },
    { i: <Ban className="h-4 w-4" />, n: "No-progress streak", d: "If N consecutive paid calls fail verify, stop and report. No burning cash on junk." },
    { i: <Lock className="h-4 w-4" />, n: "Iteration backstop", d: "Absolute max loop turns per run — regardless of remaining budget." },
  ];
  return (
    <section id="guardrails" className="border-t border-[#12131A]/10">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <SectionHeader
          eyebrow="The five guardrails"
          title={
            <>
              Deterministic conscience.
              <br />
              <em className="italic text-[#B08D3F]">Pure functions.</em> Zero network.
            </>
          }
          lead="Every proposed paid call passes through all five before the wallet can sign. Order is security-critical: cache → backstop → no-progress → budget → per-call."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {rails.map((r, i) => (
            <div
              key={r.n}
              className="group relative flex flex-col rounded-xl border border-[#12131A]/15 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-[#12131A]/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#12131A] text-[#B08D3F]">
                  {r.i}
                </div>
                <span className="font-mono-num text-[10px] tracking-[0.2em] text-[#12131A]/40">
                  0{i + 1}
                </span>
              </div>
              <div className="mt-6 font-serif-display text-[22px] leading-tight">{r.n}</div>
              <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-[#12131A]/65">{r.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoStrip() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const cold = "$0.098";
  const warm = "$0.050";

  return (
    <section className="relative overflow-hidden border-t border-[#12131A]/10 bg-[#F5F2EA]">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <SectionHeader
              eyebrow="The money shot"
              title={
                <>
                  Run it twice.
                  <br />
                  The second run <em className="italic text-[#B08D3F]">remembers</em>.
                </>
              }
              lead="Cold run explores and gets burned. Warm run reads memory, skips the bad provider, and spends less to answer the same question."
            />

            <div className="mt-10 flex flex-wrap items-end gap-8">
              <Delta label="Cold run" value={cold} tone="ink" />
              <div className="mb-1 font-mono-num text-xs uppercase tracking-[0.2em] text-[#12131A]/40">
                →
              </div>
              <Delta label="Warm run" value={warm} tone="brass" />
              <Delta label="Saved by memory" value="$0.048" tone="green" pulse />
            </div>

            <Link
              href="/app"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#12131A] px-6 py-3.5 text-sm font-medium text-[#F5F2EA] transition-all hover:bg-[#12131A]/90"
            >
              Try it in the ledger
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <DemoLedger tick={tick} />
        </div>
      </div>
    </section>
  );
}

function Delta({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: string;
  tone: "ink" | "brass" | "green";
  pulse?: boolean;
}) {
  const color =
    tone === "brass" ? "text-[#B08D3F]" : tone === "green" ? "text-[#2F6D4F]" : "text-[#12131A]";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-[#12131A]/50">{label}</div>
      <div className={`font-mono-num text-4xl tabular ${color} ${pulse ? "anim-tick" : ""}`}>{value}</div>
    </div>
  );
}

function DemoLedger({ tick }: { tick: number }) {
  const rows = [
    { s: "plan", d: "3 sub-goals identified", a: "—", t: "plan", tone: "mute" as const },
    { s: "holders", d: "provider A", a: "$0.008", t: "pay ✓", tone: "ok" as const },
    { s: "liquidity", d: "provider B", a: "$0.012", t: "dropped", tone: "bad" as const },
    { s: "liquidity", d: "provider C", a: "$0.010", t: "pay ✓", tone: "ok" as const },
    { s: "dedupe", d: "duplicate call", a: "$0.010", t: "saved", tone: "mute" as const },
    { s: "audit", d: "over per-call limit", a: "$0.060", t: "escalated", tone: "warn" as const },
  ];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#12131A]/15 bg-[#12131A] p-6 text-[#F5F2EA] shadow-[0_40px_80px_-30px_rgba(18,19,26,0.5)]">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#F5F2EA]/50">
        <span>Decision ledger · cold run</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2F6D4F] anim-tick" />
          live
        </span>
      </div>

      <div className="mt-5 divide-y divide-[#F5F2EA]/8">
        {rows.map((r, i) => {
          const visible = i <= (tick % (rows.length + 2));
          const toneClass =
            r.tone === "ok"
              ? "border-[#2F6D4F]/40 text-[#2F6D4F]"
              : r.tone === "bad"
              ? "border-[#9B4A38]/40 text-[#9B4A38]"
              : r.tone === "warn"
              ? "border-[#B08D3F]/40 text-[#B08D3F]"
              : "border-[#F5F2EA]/20 text-[#F5F2EA]/60";
          return (
            <div
              key={i}
              className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-4 py-3 font-mono-num text-[12px] transition-opacity duration-500"
              style={{ opacity: visible ? 1 : 0.15 }}
            >
              <span className="text-[#F5F2EA]/50">{r.s}</span>
              <span className="text-[#F5F2EA]/85">{r.d}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${toneClass}`}>
                {r.t}
              </span>
              <span className="w-16 text-right tabular text-[#F5F2EA]">{r.a}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[#F5F2EA]/10 pt-4 font-mono-num text-[11px] uppercase tracking-[0.18em]">
        <span className="text-[#F5F2EA]/50">total x402 spend</span>
        <span className="tabular text-2xl text-[#B08D3F]">$0.098</span>
      </div>

      {/* subtle scan */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#B08D3F]/10 to-transparent anim-scan" />
    </div>
  );
}

function Halal() {
  const bad = ["Interest / lending / yield", "Leverage or perpetuals", "Betting / prediction markets", "Custody of others' funds"];
  const good = ["Spot USDC · services rendered", "Non-custodial · user's own wallet", "Full audit trail on-chain", "Deterministic guardrails in code"];
  return (
    <section className="border-t border-[#12131A]/10">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <SectionHeader
          eyebrow="Halal by design"
          title={
            <>
              Spot payments.
              <br />
              For <em className="italic text-[#B08D3F]">services rendered</em>. Nothing else.
            </>
          }
          lead="A genuine values fit — and a clean separation from the gambling-adjacent x402 demos that usually show up at these events."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#12131A]/15 bg-white p-8">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#2F6D4F]">Included</div>
            <ul className="mt-5 space-y-3">
              {good.map((g) => (
                <li key={g} className="flex items-center gap-3 border-b border-[#12131A]/10 pb-3 text-[15px] last:border-0">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2F6D4F]/10 text-[#2F6D4F]">✓</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[#12131A]/15 bg-[#12131A] p-8 text-[#F5F2EA]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#9B4A38]">Excluded</div>
            <ul className="mt-5 space-y-3">
              {bad.map((g) => (
                <li key={g} className="flex items-center gap-3 border-b border-[#F5F2EA]/10 pb-3 text-[15px] last:border-0">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9B4A38]/15 text-[#9B4A38]">✕</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#12131A] text-[#F5F2EA]">
      <div className="mx-auto max-w-5xl px-6 py-32 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#F5F2EA]/15 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#F5F2EA]/60">
          <Eye className="h-3 w-3 text-[#B08D3F]" />
          Watch the agent decide
        </div>
        <h2 className="font-serif-display text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-[88px]">
          Not a payment demo.
          <br />
          A <em className="italic text-[#B08D3F]">control plane</em>.
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-[16px] leading-relaxed text-[#F5F2EA]/70">
          Reasoning on the BTL Runtime, payments over x402, memory and judgment in between.
          Spot-only USDC, non-custodial, no leverage or gambling.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="group inline-flex items-center gap-2 rounded-full bg-[#F5F2EA] px-7 py-4 text-sm font-medium text-[#12131A] transition-all hover:bg-white"
          >
            Launch ThinkPay
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#architecture"
            className="inline-flex items-center gap-2 rounded-full border border-[#F5F2EA]/25 px-7 py-4 text-sm font-medium text-[#F5F2EA]/80 transition-all hover:border-[#F5F2EA] hover:text-[#F5F2EA]"
          >
            Read the architecture
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#12131A]/10 bg-[#F5F2EA]">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <LedgerMark />
          <div>
            <div className="text-sm font-semibold">ThinkPay</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#12131A]/50">
              A spending conscience for AI agents
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-[12px] uppercase tracking-[0.18em] text-[#12131A]/60">
          <span>BTL Runtime Hackathon · 2026</span>
          <span className="inline-flex items-center gap-1.5">
            <Github className="h-3.5 w-3.5" />
            source
          </span>
        </div>
      </div>
    </footer>
  );
}
