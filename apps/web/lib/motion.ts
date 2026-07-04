/**
 * The product's entire motion vocabulary. Two curves, five springs, named timings.
 * No magic numbers in components.
 */

export const EASE = {
  counting: [0.21, 0.86, 0.22, 1] as const, // brand ease-out — coin into slot
  stamp: [0.34, 1.28, 0.36, 1] as const, // overshoot — stamp thunk
};

export const SPRING = {
  panel: { type: "spring", stiffness: 300, damping: 30 } as const, // section entrances
  row: { type: "spring", stiffness: 400, damping: 30 } as const, // ledger row insert
  stamp: { type: "spring", stiffness: 500, damping: 22 } as const, // ✓/✗ stamps (overshoot)
  meter: { type: "spring", stiffness: 120, damping: 20 } as const, // mass-y bar fill
  reorder: { type: "spring", stiffness: 350, damping: 32 } as const, // provider FLIP
};

/* ────────────────────────────────────────────────────────────
 * PAGE LOAD STORYBOARD  (run controls interactive from 120ms)
 *
 *    0ms   room lights come up: 3D key light 0 → full over 900ms
 *  120ms   header: scale glyph + THINKPAY fade in
 *  280ms   ledger paper rises from bottom-right + warm halo blooms
 *  480ms   SpendMeter slides from left
 *  620ms   ProviderTable slides from left; rows stagger 40ms
 *  900ms   empty-state line TYPES onto the paper, 18ms/char
 * 1300ms   Run button: one brass ring shimmer (the invitation)
 * ──────────────────────────────────────────────────────────── */
export const TIMING = {
  load: { lights: 0, header: 0.12, ledger: 0.28, meter: 0.48, table: 0.62, invite: 0.9 },
  row: { insert: 0, rule: 0.06, digits: 0.12, stamp: 0.3, hash: 0.42, meter: 0.48 },
  esc: { halt: 0, dim: 0, spotlight: 0.08, chip: 0.16 },
  done: { settle: 0.25, saved: 0.4, dual: 0.7, seal: 1.3 },
  compare: { cold: 0, warm: 0.2, delta: 0.65, roll: 0.9 },
  typeCharMs: 18,
  rowStagger: 0.04,
} as const;

/** entry > exit, everywhere */
export const DUR = {
  rowEnter: 0.48,
  rowExit: 0.2,
  chipEnter: 0.22,
  chipExit: 0.14,
  fade: 0.15, // reduced-motion universal
} as const;
