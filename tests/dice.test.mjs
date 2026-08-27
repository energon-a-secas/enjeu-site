// The ported dice bridge must equal the documented table, tie-break included.
import assert from 'node:assert/strict';
import { ladderTable, bestTarget, fidelity, shiftStep, targetFor, rollDie, dieMax } from '../js/game/rules.js';
import { rng } from '../js/utils.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

// docs/DICE-BRIDGE.md, the table tools/dice_bridge.py prints.
const DOC = {
  sure: { d20: 6,  d12: 4,  d10: 3, d8: 3, d6: 2, d4: 2, '2d6': 6,  '3d6': 9 },
  even: { d20: 11, d12: 7,  d10: 6, d8: 5, d6: 4, d4: 3, '2d6': 7,  '3d6': 11 },
  hard: { d20: 16, d12: 10, d10: 8, d8: 7, d6: 5, d4: 4, '2d6': 9,  '3d6': 13 },
  wild: { d20: 18, d12: 11, d10: 9, d8: 8, d6: 6, d4: 4, '2d6': 10, '3d6': 14 },
};

test('the ported ladder equals DICE-BRIDGE.md for all 32 cells', () => {
  const { rows } = ladderTable();
  for (const r of rows) assert.deepEqual(r.targets, DOC[r.step], `step ${r.step}`);
});

test('2d6 Even is 7+ (tie breaks toward the generous target, the bug the Python fixed)', () => {
  assert.equal(bestTarget('2d6', 0.5).target, 7);
});

test('3d6 Even is exactly 50% (108 of 216) and d20 is exact everywhere', () => {
  assert.equal(bestTarget('3d6', 0.5).odds, 0.5);
  for (const [step, p] of [['sure', 0.75], ['even', 0.5], ['hard', 0.25], ['wild', 0.15]]) assert.equal(bestTarget('d20', p).odds, p, step);
});

test('fidelity ranking: d20 exact, 3d6 within 1.2 points, d4 worst at 10', () => {
  const f = fidelity();
  assert.equal(f[0].die, 'd20'); assert.ok(f[0].gap < 0.005);
  assert.ok(Math.abs(f.find((x) => x.die === '3d6').gap - 0.012) < 0.002);
  assert.equal(f[f.length - 1].die, 'd4'); assert.ok(Math.abs(f[f.length - 1].gap - 0.10) < 0.001);
});

test('shiftStep: Roar and the mode dial move exactly one rung and clamp', () => {
  assert.equal(shiftStep('sure', 1), 'even');
  assert.equal(shiftStep('wild', 1), 'wild');
  assert.equal(shiftStep('sure', -1), null, 'Story mode makes Sure automatic');
  assert.equal(shiftStep(null, 1), 'sure', 'a no-check attack made harder becomes a Sure check');
  assert.equal(targetFor('d20', null), null);
  assert.equal(targetFor('3d6', 'hard'), 13);
});

test('rollDie stays in range and covers the range', () => {
  const next = rng(7);
  for (const die of ['d20', 'd6', '2d6', '3d6']) {
    const seen = new Set();
    for (let i = 0; i < 5000; i++) { const r = rollDie(die, next); assert.ok(r >= 1 && r <= dieMax(die)); seen.add(r); }
    assert.equal(seen.size, die === '2d6' ? 11 : die === '3d6' ? 16 : dieMax(die), die);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
