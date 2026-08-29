// Grudge: what a lost attempt buys the next one, and P(clear within 3 tries).
import { readFileSync } from 'node:fs';
import { useCards } from '../../js/data/cards.js';
import { runCell } from '../../js/game/sim.js';
const data = useCards(JSON.parse(readFileSync('data/cards.json', 'utf8')));
const T = Number(process.env.T || 8000);
console.log(`Grudge as auto-successes, ${T.toLocaleString()} fights per cell, adaptive\n`);
console.log('lvl   0 grudges  1 grudge  2 grudges   P(clear in <=3 tries) without -> with');
for (let L = 1; L <= 5; L++) {
  const w = [0, 1, 2].map((g) => runCell(data, { level: L, style: 'adaptive', runes: g }, T).win / 100);
  const flat = 1 - (1 - w[0]) ** 3;
  const laddered = 1 - (1 - w[0]) * (1 - w[1]) * (1 - w[2]);
  console.log(` ${L}    ${(w[0] * 100).toFixed(1).padStart(6)}%   ${(w[1] * 100).toFixed(1).padStart(6)}%   ${(w[2] * 100).toFixed(1).padStart(6)}%      ${(flat * 100).toFixed(1)}% -> ${(laddered * 100).toFixed(1)}%`);
}
