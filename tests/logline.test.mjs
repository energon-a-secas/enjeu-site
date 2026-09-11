// The display-seam translation of the engine's fight log. The sample list IS
// the coverage contract: one concrete line per say() shape in
// js/game/engine.js, both branches where a shape has them. A new say() line
// in the engine needs its sample here and its pattern in js/views/logline.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { setLang } from '../js/strings.js';
import { logLine, setLogNames } from '../js/views/logline.js';
import * as E from '../js/game/engine.js';
import { MARK_IDS } from '../js/game/marks.js';
import { playTurn } from '../js/game/strategies.js';
import { useExpansions, objectFor } from '../js/data/expansions.js';
import { rng } from '../js/utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const mods = useExpansions(JSON.parse(readFileSync(join(root, 'data/expansions.json'), 'utf8')));
setLogNames(data, mods);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

// One sample per engine say() shape. Where the expectation matters beyond
// "translated", it is stated; otherwise the assertion is that the line moved
// and dropped its English tells.
const SAMPLES = [
  ['Round 3. 4 Ready.', 'Ronda 3. 4 En Pie.'],
  ['Rage: double damage, no guard.'],
  ['Rage next round.'],
  ['Bubble: the next 25 damage is absorbed.'],
  ['Taunt: the boss will roll 4.', 'Provocación: el jefe sacará 4.'],
  ['Run: you are Hidden. The boss has to find you.'],

  // Expansion M1: Terrain. Every say() the Mark code can emit, because the
  // engine stays monolingual on purpose and this list is the coverage contract.
  ['You are Poisoned.', 'Estás Envenenado.'],
  ['You are Snared.', 'Estás Atrapado.'],
  ['Ember Beetle is Burning.'],
  ['Ember Beetle is Frozen and loses its action.'],
  ['Your marks cost you 25.', 'Tus marcas te cuestan 25.'],
  ['A minion suffers 25.', 'Un esbirro sufre 25.'],
  ['Ember Beetle suffers 50.'],
  ['You shake off Poison and Snared.', 'Te sacudes Veneno y Atrapado.'],
  ['You shake off Poison.', 'Te sacudes Veneno.'],
  ['Lava Vent: you use the ground against it.', 'Grieta de Lava: usas el terreno contra él.'],
  ['Snared: it cannot brace.', 'Atrapado: no puede hacer Aguante.'],
  ['You spend your Charge.', 'Gastas tu Carga.'],
  ['Your Charge is lost.', 'Pierdes tu Carga.'],
  ['Burning goes out.', 'Ardiendo se apaga.'],
  ['Strike: lands, 25 damage.', 'Golpe: acierta solo, 25 de daño.'],
  ['Focus (bet 1): hit, 75 damage.', 'Puntería (apuesta 1): acierta, 75 de daño.'],
  ['All In (bet 3): miss.', 'Todo o Nada (apuesta 3): falla.'],
  ['Reroll: hit, 100 damage.'],
  ['Reroll: miss.'],
  ['It was off balance: +25.'],
  ['Focus fells a minion.', 'Puntería tumba un esbirro.'],
  ['Ally fells a minion.', 'El Aliado tumba un esbirro.'],
  ['Necromancer takes one of its cards as a Ready life card.'],
  ['The boss falls!', '¡El jefe cae!'],
  ['Its minions scatter.', 'Sus esbirros se dispersan.'],
  ['You break a part off the boss (1 of 2).'],
  ['The part holds. Nothing comes off.'],
  ['The break tears 50 off it.'],
  ['Crippled: the boss now deals 25.'],
  ['Trophy: one check this level succeeds automatically.'],
  ['The comeback fails. You are Down.'],
  ['Second Wind holds! Back up with 4 cards.'],
  ['Second Wind holds! Back up with 1 cards.', '¡Segundo Aire aguanta! De vuelta con 1 carta.'],
  ['Second Wind: you come back free.'],
  ['You slip into the trees. The boss has to find you.'],
  ['Cure: two Broken cards return to Ready.'],
  ["Ally: a companion joins, Strikes for 25 each turn and draws the boss's Strike behind 50 defense."],
  ['Rune: one check this level succeeds automatically.'],
  ['Relic: every landed attack deals +25 this level.'],
  ['Chest: draw two more Advantage cards.'],
  ['A minion strikes for 25.'],
  ['The Ally takes it: 50 defense absorbs all 40.'],
  ['The Ally covers you and falls: 75 was more than its 50 defense.'],
  ["Barrier cancels the boss's Roar.", 'Barrera cancela la reacción del jefe: Rugido.'],
  ["Barrier cancels the boss's Stormbreak.", 'Barrera cancela la reacción del jefe: Rompetormentas.'],
  ['The boss Braces: no damage, and it halves what it takes until the end of your next turn.'],
  ['The boss Summons: 200 of its life moves under a minion.'],
  ['Skitter: it darts aside, no damage, and it is off balance. Your next landed hit deals +25.'],
  ['Coil: 200 of its life moves under a minion, and the minion strikes at once.'],
  ['Bedrock: it braces, and 25 of its wall grinds back into place.'],
  ['Stormbreak! Ruin: 200.', '¡Rompetormentas! Ruina: 200.'],
  ['Stormbreak! Ruin: 200. No card of yours is standing: it Ruins AGAIN.',
    '¡Rompetormentas! Ruina: 200. Ninguna carta tuya sigue en pie: hace Ruina OTRA VEZ.'],
  ['Hoard: the boss deals nothing. It is busy pocketing your life.'],
  ['It steals a Ready life card: gone for the level, and its 25 joins the wall.'],
  ['Hoard: nothing standing to steal. It Roars for 100 instead.'],
  ['The boss Roars for 100. Your next check is one step harder.'],
  ['Ruin! The boss deals 150.', '¡Ruina! El jefe hace 150.'],
  ['The boss Strikes for 50.', 'El jefe Golpea por 50.'],
  ['The boss Strikes at the Ally for 50.', 'El jefe Golpea al Aliado por 50.'],
  ['You break cover to shield the Ally.'],
  ['You cover the Ally and take it whole.'],
  ['Castle: the boss acts again. You catch your breath between swings.'],
  ['Hidden: the Strike goes past you. No damage.'],
  ['Hidden: Ruin finds you anyway, halved to 75.'],
  ['Hidden: it finds you anyway, halved to 50.'],
  ['Bubble absorbs 25.', 'Burbuja absorbe 25.'],
  ['Knight guards 25 for free.'],
  ['Guarded 50 with 2 Ready cards; they return next round.',
    'Defendiste 50 con 2 cartas En Pie; vuelven la próxima ronda.'],
  ['Guarded 25 with 1 Ready card; they return next round.',
    'Defendiste 25 con 1 carta En Pie; vuelven la próxima ronda.'],
  ['You are Down. Second Wind?', 'Estás Caído. ¿Segundo Aire?'],
  ['You are Down.', 'Estás Caído.'],
  ['3 Broken.', '3 Rotas.'],
];

// English words whose survival in an "es" line means the pattern missed. Kept
// to words no Spanish translation would contain.
const TELLS = /\b(the|boss|damage|Ready|Broken|Down|Guarded|minion|strikes?|Roars?|deals?|next|your?|with|and)\b/i;

test('every engine line shape translates under es, with no English tells left', () => {
  setLang('es');
  for (const [en, expected] of SAMPLES) {
    const out = logLine(en);
    assert.notEqual(out, en, `untranslated: "${en}"`);
    if (expected) assert.equal(out, expected);
    assert.ok(!TELLS.test(out), `English tell survives in "${out}" (from "${en}")`);
  }
});

test('en passes through untouched, and so does a line no pattern knows', () => {
  setLang('en');
  assert.equal(logLine('Round 3. 4 Ready.'), 'Round 3. 4 Ready.');
  setLang('es');
  assert.equal(logLine('A brand new line the table has never met.'),
    'A brand new line the table has never met.', 'unknown lines degrade to English, never to broken text');
  setLang('en');
});

test('the name map localizes card, reaction and signature names inside lines', () => {
  setLang('es');
  assert.ok(logLine('Invention (bet 1): hit, 350 damage.').startsWith('Invención'));
  assert.ok(logLine("Barrier cancels the boss's Coil.").includes('Enroscada'));
  setLang('en');
});

/**
 * The sample list above is hand-kept, and a hand-kept coverage contract drifts
 * the moment someone adds a say() and forgets it. This plays real fights with
 * every module switched on and asserts that EVERY line they actually produce
 * translates, which is the same contract enforced by the engine rather than by
 * memory. It names the offending line, so a miss is a one-line fix.
 */
test('every line real fights produce has a pattern, modules included', () => {
  setLang('es');
  const seen = new Set();
  const next = rng(99);
  const BIOMES = ['volcano', 'river', 'mountain', 'desert', 'forest', 'village', 'castle'];
  for (let i = 0; i < 400; i++) {
    const boss = data.boss[Math.min(5, Math.floor(next() * 6))];
    const biome = BIOMES[Math.floor(next() * BIOMES.length)];
    const f = E.newFight(data, {
      level: 1 + Math.floor(next() * 5), boss, biome: { id: biome, element: null },
      hero: { element: 'fire', klass: null, attacks: data.attack,
        pool: Array.from({ length: 4 + Math.floor(next() * 6) }, () => 'fire') },
      die: 'd20', mode: 'standard', secondWind: next() < 0.5,
      dm: { on: true, style: 'friendly', cap: 3, step: 'hard', wound: 50, cripple: 25 },
    });
    let guard = 0;
    while (f.phase === 'act' && guard++ < 40) {
      if (next() < 0.4) E.applyMark(f, next() < 0.5 ? 'hero' : 'body', MARK_IDS[Math.floor(next() * MARK_IDS.length)]);
      const obj = objectFor(mods, biome);
      if (obj && E.canUseObject(f, obj) && next() < 0.3) E.useObject(f, obj);
      if (E.canShake(f) && next() < 0.4) E.shake(f);
      if (f.phase !== 'act') break;
      playTurn(f, ['turtle', 'safe', 'adaptive', 'gamble'][Math.floor(next() * 4)], next, () => null);
      if (next() < 0.4 && E.canBreak(f)) E.breakPart(f, { roll: 20, part: 'a horn' });
      while (f.phase === 'down') E.attemptRevive(f, { u: next() });
      if (f.phase !== 'act') break;
      E.endTurn(f);
      while (f.phase === 'down') E.attemptRevive(f, { u: next() });
      while (f.phase === 'boss') {
        E.bossRoll(f, 1 + Math.floor(next() * 6));
        E.resolveBoss(f, {});
        while (f.phase === 'down') E.attemptRevive(f, { u: next() });
        if (f.phase === 'down') break;
      }
    }
    for (const l of f.log) seen.add(l.text);
  }
  const untranslated = [...seen].filter((line) => logLine(line) === line);
  assert.equal(untranslated.length, 0,
    `${untranslated.length} of ${seen.size} line shapes have no Spanish:\n       ${untranslated.slice(0, 10).join('\n       ')}`);
  setLang('en');
});


console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
