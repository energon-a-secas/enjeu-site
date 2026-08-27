// ── The published balance table ──────────────────────────────
// docs/BALANCE.md, measured by tools/sim.py at 20,000 fights per cell, seed
// 7, no affinity bonus. Copied here ONCE so the Balance view can show it
// beside a fresh run and tests/engine.test.mjs can assert parity against it.
// If BALANCE.md is re-measured, this table changes with it.
export const PUBLISHED = {
  styles: ['turtle', 'safe', 'adaptive', 'gamble'],
  rows: [
    { level: 1, win: [53.2, 87.9, 89.9, 67.0], rounds: 3.1, broken: 1.1 },
    { level: 2, win: [4.1, 78.8, 82.7, 48.3], rounds: 3.3, broken: 1.5 },
    { level: 3, win: [0.0, 52.7, 69.2, 55.6], rounds: 3.4, broken: 2.4 },
    { level: 4, win: [0.0, 42.5, 61.4, 60.7], rounds: 3.3, broken: 3.2 },
    { level: 5, win: [0.0, 45.2, 61.2, 45.5], rounds: 3.9, broken: 3.8 },
  ],
  trials: 20000,
};
