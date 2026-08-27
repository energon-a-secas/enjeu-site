// What the gentle-mode card actually buys a player, measured.
import { readFileSync } from 'node:fs';
import { useCards } from '../../js/data/cards.js';
import { runCell } from '../../js/game/sim.js';
import { STYLES } from '../../js/game/strategies.js';
const data = useCards(JSON.parse(readFileSync('data/cards.json', 'utf8')));
const T = 4000;
console.log('Second Wind: win% without the card -> with it, 4,000 fights per cell\n');
console.log('lvl style       off      on     delta');
const tot = { off: 1, on: 1 };
for (let L = 1; L <= 5; L++) {
  for (const st of STYLES) {
    const off = runCell(data, { level: L, style: st }, T);
    const on = runCell(data, { level: L, style: st, secondWind: true }, T);
    if (st === 'adaptive') { tot.off *= off.win / 100; tot.on *= on.win / 100; }
    const d = on.win - off.win;
    console.log(` ${L}  ${st.padEnd(9)} ${off.win.toFixed(1).padStart(5)}%  ${on.win.toFixed(1).padStart(5)}%   ${(d >= 0 ? '+' : '') + d.toFixed(1)}`);
  }
}
console.log(`\nfull five-level run on the adaptive line: ${(tot.off * 100).toFixed(1)}% -> ${(tot.on * 100).toFixed(1)}%`);
