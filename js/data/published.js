// ── The published balance table ──────────────────────────────
// docs/BALANCE.md, measured by tools/sim.py at 20,000 fights per cell, seed
// 7, no affinity bonus. Copied here ONCE so the Balance view can show it
// beside a fresh run and tests/engine.test.mjs can assert parity against it.
// If BALANCE.md is re-measured, this table changes with it.
export const PUBLISHED = {
  styles: ['turtle', 'safe', 'adaptive', 'gamble'],
  rows: [
    { level: 1, win: [53.2, 87.9, 90.8, 67.4], rounds: 3.1, broken: 1.0 },
    { level: 2, win: [4.3, 78.7, 84.1, 55.2], rounds: 3.3, broken: 1.4 },
    { level: 3, win: [0.0, 52.9, 64.6, 55.4], rounds: 3.3, broken: 2.6 },
    { level: 4, win: [0.0, 42.6, 59.5, 60.6], rounds: 3.3, broken: 3.3 },
    { level: 5, win: [0.0, 45.1, 61.0, 44.6], rounds: 3.9, broken: 3.8 },
  ],
  trials: 20000,
};
