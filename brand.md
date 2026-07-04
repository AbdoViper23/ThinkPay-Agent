# Brand — Mizan

_Status: active_ · Source of truth: `docs/04-FRONTEND.md` + `apps/web/app/globals.css`

**Identity: "The Counting Room."** A dark counting-house where money moves as light. The product is a spending conscience for AI agents; the UI is a control room built around one lit paper ledger. **All copy is English only.**

## Palette

| Token | Hex | Role |
|---|---|---|
| ink-0 / ink-room | `#0D0E12` / `#12131A` | page base / room + fog (never pure black) |
| surface-1/2/3 | `#1A1814` / `#211E18` / `#2A261E` | warm-dark panels, raised, inputs |
| paper | `#F5F2EA` (rule `#EAE5D8`, edge `#E3DDCB`, ink `#1F1D18`) | the ledger — the one lit object |
| brass / bright / dim | `#B08D3F` / `#D4AF5E` / `#6E5A2C` | **money-in-motion ONLY** — the single accent |
| verified / hi | `#2F6D4F` / `#4C9C74` | verify pass |
| rust / hi | `#9B4A38` / `#C26A50` | rejected / blocked |
| text hi/mid/low | `#E8E4DA` / `#A8A296` / `#6B665C` | on dark |

No violet/blue gradients. No pure `#000`. One accent (brass), semantic green/rust only.

## Typography

- **IBM Plex Mono** 400/500/600 + true italic — ALL numbers, hashes, ledger rows, timestamps. `tabular-nums` global; numbers right-aligned.
- **Space Grotesk** 400/500/700 — labels, headings, controls. Uppercase labels at 11px +0.08em.

## Radii by role (non-uniform, deliberate)

paper 2px · panels 12px · controls 6px · chips 999px · rows 4px

## Motion

Two curves only: `counting cubic-bezier(0.21,0.86,0.22,1)` (ease-out) and `stamp cubic-bezier(0.34,1.28,0.36,1)` (overshoot). Five named springs in `apps/web/lib/motion.ts`. Entry > exit. Everything respects `prefers-reduced-motion`.

## Voice

Plain, active, specific. Errors say what happened and how to fix it ("Could not reach the agent on :3001 — is it running?"). The empty state is an invitation: "Give the agent a task and a budget. Watch it decide what's worth paying for."
