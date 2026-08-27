import { readFileSync } from 'node:fs';
import { useCards } from '../../js/data/cards.js';
import { runCell } from '../../js/game/sim.js';
import { STYLES } from '../../js/game/strategies.js';
const data = useCards(JSON.parse(readFileSync('data/cards.json', 'utf8')));
const T = 4000;
console.log('rulebook rules, 4,000 fights per cell. Bubble ON is the shipped game.\n');
console.log('lvl style      no Bubble   with Bubble   delta');
for (let L = 1; L <= 5; L++) {
  for (const st of STYLES) {
    const off = runCell(data, { level: L, style: st, noBubble: true }, T);
    const on  = runCell(data, { level: L, style: st }, T);
    const d = on.win - off.win;
    console.log(` ${L}  ${st.padEnd(9)} ${off.win.toFixed(1).padStart(6)}%     ${on.win.toFixed(1).padStart(6)}%   ${(d >= 0 ? '+' : '') + d.toFixed(1)}`);
  }
}
