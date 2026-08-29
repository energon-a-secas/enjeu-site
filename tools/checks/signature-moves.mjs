// What the five signature moves cost, and buy, per level.
import { readFileSync } from 'node:fs';
import { useCards } from '../../js/data/cards.js';
import { runCell } from '../../js/game/sim.js';
const data = useCards(JSON.parse(readFileSync('data/cards.json', 'utf8')));
const T = Number(process.env.T || 8000);
console.log(`signature moves, ${T.toLocaleString()} fights per cell, rulebook rules\n`);
console.log('lvl  style      plain     signed   delta   (the signed column is the shipped game)');
for (let L = 1; L <= 5; L++) {
  for (const st of ['adaptive', 'gamble']) {
    const off = runCell(data, { level: L, style: st, noSignatures: true }, T);
    const on = runCell(data, { level: L, style: st }, T);
    console.log(` ${L}  ${st.padEnd(9)} ${off.win.toFixed(1).padStart(6)}%  ${on.win.toFixed(1).padStart(6)}%  ${(on.win - off.win >= 0 ? '+' : '') + (on.win - off.win).toFixed(1)}`);
  }
}
