#!/usr/bin/env node
// ── Balance parity ───────────────────────────────────────────
// Proves an expansion module did not move the base game.
//
//     node tools/parity.mjs                 # working tree vs HEAD
//     node tools/parity.mjs v1.6.0          # working tree vs a tag
//     node tools/parity.mjs HEAD 1000       # fewer fights, for a quick check
//
// The whole promise of docs/EXPANSIONS.md is that every module is droppable:
// leave it in the box and nothing else changes. That promise is checkable
// rather than assertable, because the simulator plays the base game with no
// module in play, and a module that leaks into it will move a number.
//
// How it works: a detached git worktree is created at the reference, the same
// 20-cell table is run in BOTH trees with the same seeds, and the two are
// diffed cell by cell. Any difference at all is a failure, because these runs
// are deterministic: same seed, same rng, same result, down to the digit.
//
// Three modes are compared, and each one catches a different kind of leak:
//   rulebook      the game as RULES.md describes it
//   rulebook+SW   with Second Wind, which changes the shape of a lost level
//   legacy        tools/sim.py parity, which docs/BALANCE.md is published from
//
// If this ever fails after adding a module, the module is not additive. That
// is a design defect, not a test to update.

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = process.argv[2] || 'HEAD';
const TRIALS = Number(process.argv[3] || 4000);
const SEED = 11;

const MODES = [
  { tag: 'rulebook', opts: { seed: SEED } },
  { tag: 'rulebook+SW', opts: { seed: SEED, secondWind: true } },
  { tag: 'legacy', opts: { seed: SEED, legacy: true } },
];

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

/** The 20-cell table in one tree, as a flat list of comparable lines. */
async function table(root) {
  // Absolute file URLs: a relative import would resolve against THIS file, and
  // the whole point is to load a different copy of the same modules.
  const { useCards } = await import(`file://${join(root, 'js/data/cards.js')}`);
  const { runTable } = await import(`file://${join(root, 'js/game/sim.js')}`);
  const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
  const out = [];
  for (const m of MODES) {
    for (const r of runTable(data, m.opts, TRIALS)) {
      out.push(`${m.tag}\t${r.level}\t${r.style}\t${r.win.toFixed(4)}\t${r.broken.toFixed(4)}`);
    }
  }
  return out;
}

const head = git('rev-parse', '--short', REF);
const work = join(tmpdir(), `enjeu-parity-${head}`);
console.log(`parity: working tree vs ${REF} (${head})`);
console.log(`        ${MODES.length} modes x 20 cells x ${TRIALS} fights, seed ${SEED}\n`);

try { rmSync(work, { recursive: true, force: true }); } catch { /* first run */ }
git('worktree', 'add', '--detach', work, REF);

let base, mine;
try {
  base = await table(work);
  mine = await table(ROOT);
} finally {
  // Always clean up: a leaked worktree makes the NEXT run fail on a path that
  // already exists, and the failure looks nothing like its cause.
  try { git('worktree', 'remove', '--force', work); } catch { /* already gone */ }
}

const diffs = [];
for (let i = 0; i < Math.max(base.length, mine.length); i++) {
  if (base[i] !== mine[i]) diffs.push({ base: base[i] ?? '(missing)', mine: mine[i] ?? '(missing)' });
}

if (!diffs.length) {
  console.log(`OK  ${base.length} cells identical.`);
  console.log('    The base game is unmoved: every module in play is genuinely droppable.');
  process.exit(0);
}

console.log(`FAIL  ${diffs.length} of ${base.length} cells moved.\n`);
console.log('  mode          lvl  style      win%     broken');
for (const d of diffs.slice(0, 20)) {
  console.log(`  ${REF.padEnd(12)} ${d.base}`);
  console.log(`  ${'working'.padEnd(12)} ${d.mine}\n`);
}
if (diffs.length > 20) console.log(`  ... and ${diffs.length - 20} more`);

// Two very different reasons a cell can move, and the tool must not pretend it
// knows which one this was. It reports the shape of the change and leaves the
// judgement where it belongs.
const modes = new Set(diffs.map((d) => d.base.split('\t')[0]));
console.log(`\nmodes touched: ${[...modes].join(', ')}`);
if (!modes.has('legacy')) {
  console.log('legacy is unchanged, so docs/BALANCE.md still reproduces.');
} else {
  console.log('legacy MOVED, so docs/BALANCE.md no longer reproduces: republish it or revert.');
}
console.log('\nIf you changed a MODULE, it is not additive: fix the module, not this check.');
console.log('If you changed the BASE GAME on purpose, review the diff above, update');
console.log('RULES.md in the same breath, and re-run against the commit that lands it.');
process.exit(1);
