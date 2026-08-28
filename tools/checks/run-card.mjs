// What the Run card actually costs the balance, measured three ways.
import { readFileSync } from 'node:fs';
import { useCards } from '../../js/data/cards.js';
import { runCell } from '../../js/game/sim.js';
import { STYLES } from '../../js/game/strategies.js';
const data = useCards(JSON.parse(readFileSync('data/cards.json', 'utf8')));
const T = Number(process.env.T || 8000);
const cases = [
  ['no Run in the deck at all', { noRun: true }],
  ['Run in the deck, played by the heuristic', {}],
];
const out = {};
for (const [label, extra] of cases) {
  console.log(`\n${label}  (${T.toLocaleString()} fights per cell)`);
  console.log('lvl  ' + STYLES.map((s) => s.padStart(9)).join(''));
  const tot = Object.fromEntries(STYLES.map((s) => [s, 1]));
  for (let L = 1; L <= 5; L++) {
    const row = [];
    for (const st of STYLES) {
      const c = runCell(data, { level: L, style: st, ...extra }, T);
      row.push(c.win.toFixed(1).padStart(8) + '%');
      tot[st] *= c.win / 100;
    }
    console.log(` ${L}  ${row.join('')}`);
  }
  out[label] = tot;
  console.log('  full run: ' + STYLES.map((s) => `${s} ${(tot[s] * 100).toFixed(2)}%`).join('  '));
}
console.log('\nSKILL ORDERING (the property BALANCE.md calls the most important):');
for (const [label, tot] of Object.entries(out)) {
  const ok = tot.adaptive > tot.safe && tot.adaptive > tot.gamble && tot.adaptive > tot.turtle;
  console.log(`  ${label}: adaptive best over a full run? ${ok ? 'YES' : 'NO'}`);
}
