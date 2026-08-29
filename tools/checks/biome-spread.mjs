// The unmeasured debt: how much each biome moves each level. The simulator had
// never been handed a biome before this harness existed.
import { readFileSync } from 'node:fs';
import { useCards } from '../../js/data/cards.js';
import { runCell } from '../../js/game/sim.js';
const data = useCards(JSON.parse(readFileSync('data/cards.json', 'utf8')));
const T = Number(process.env.T || 6000);
const biomes = data.biome;
console.log(`biome spread, adaptive, Fire hero, ${T.toLocaleString()} fights per cell`);
console.log('(volcano is the element-matched column; river/mountain/desert show the unmatched case)\n');
console.log('lvl  ' + biomes.map((b) => b.id.slice(0, 7).padStart(8)).join('') + '   spread');
for (let L = 1; L <= 5; L++) {
  const row = biomes.map((b) => runCell(data, { level: L, style: 'adaptive', biome: { id: b.id, element: b.element, rule: b.rule } }, T).win);
  const spread = Math.max(...row) - Math.min(...row);
  console.log(` ${L}  ` + row.map((w) => w.toFixed(1).padStart(7) + '%').join('') + `   ${spread.toFixed(1)}`);
}
