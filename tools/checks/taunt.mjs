// Taunt: the price of information. The Knight burns an action to see the die.
import { readFileSync } from 'node:fs';
import { useCards } from '../../js/data/cards.js';
import { runCell } from '../../js/game/sim.js';
const data = useCards(JSON.parse(readFileSync('data/cards.json', 'utf8')));
const T = Number(process.env.T || 8000);
console.log(`Taunt (knight), ${T.toLocaleString()} fights per cell\n`);
console.log('lvl  style      without    with    delta');
for (let L = 1; L <= 5; L++) {
  for (const st of ['safe', 'adaptive']) {
    const off = runCell(data, { level: L, style: st, klass: 'knight' }, T);
    const on = runCell(data, { level: L, style: st, klass: 'knight', withTaunt: true }, T);
    console.log(` ${L}  ${st.padEnd(9)} ${off.win.toFixed(1).padStart(6)}%  ${on.win.toFixed(1).padStart(6)}%  ${(on.win - off.win >= 0 ? '+' : '') + (on.win - off.win).toFixed(1)}`);
  }
}
