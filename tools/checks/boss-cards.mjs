// Boss life as a uniform 100 per card: what it costs the balance.
//
// The change is for the table, not the maths: a child breaking one card per 100
// damage never has to divide. But Summon moves CARDS, not points, so making the
// cards uniform silently changes how big a minion is at every level. This is the
// measurement that keeps that from being a guess.
import { readFileSync } from 'node:fs';
import { useCards } from '../../js/data/cards.js';
import { runCell } from '../../js/game/sim.js';
import { STYLES } from '../../js/game/strategies.js';

const file = process.argv[2] || 'data/cards.json';
const label = process.argv[3] || file;
const T = Number(process.env.T || 6000);
const data = useCards(JSON.parse(readFileSync(file, 'utf8')));

console.log(`${label}: rulebook rules, ${T.toLocaleString()} fights per cell\n`);
console.log('lvl  ' + STYLES.map((s) => s.padStart(9)).join('') + '   rounds  broken');
const totals = {};
for (const st of STYLES) totals[st] = 1;
for (let L = 1; L <= 5; L++) {
  const row = [];
  let rounds = 0, broken = 0;
  for (const st of STYLES) {
    const c = runCell(data, { level: L, style: st }, T);
    row.push(c.win.toFixed(1).padStart(8) + '%');
    totals[st] *= c.win / 100;
    if (st === 'adaptive') { rounds = c.rounds; broken = c.broken; }
  }
  console.log(` ${L}  ${row.join('')}   ${rounds.toFixed(1).padStart(5)}   ${broken.toFixed(1).padStart(5)}`);
}
console.log('\nfull-run completion (product of the five levels):');
for (const st of STYLES) console.log(`  ${st.padEnd(9)} ${(totals[st] * 100).toFixed(2)}%`);
