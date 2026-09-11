// Marks (docs/EXPANSIONS.md M1): the expansion primitive, and the five rules
// that keep it playable by a child.
//
// Every guard in js/game/marks.js is tripped here rather than merely exercised.
// A rule that cannot be made to fail is not a rule, it is a comment, and two of
// the five below (no stacking, nothing worth more than 25 or one rung) are the
// entire reason this can be bolted onto a game a seven-year-old plays.
//
// The sixth thing this file protects is the base game: marks are only ever
// placed by applyMark(), legacy refuses it outright, and a fight that never
// places one must play EXACTLY as it did before this module existed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards, DECKS } from '../js/data/cards.js';
import {
  newFight, startRound, endTurn, bossRoll, resolveBoss, take, attack, hide, shake, canShake,
  legalAttacks, ready, spent, broken, effectiveStep, attackDamage, applyMark, figureAt, bossDown,
  useObject, canUseObject,
} from '../js/game/engine.js';
import { MARKS, MARK_IDS, hasMark, listMarks, tickMarks, markStep, markBonus, addMark } from '../js/game/marks.js';
import { useExpansions, objectFor, hazards, drawHazard, moduleOf, moduleCards, moduleSheets } from '../js/data/expansions.js';
import { cardFace } from '../js/cards/face.js';
import { backKind } from '../js/cards/sheet.js';
import { hasGlyph, GLYPHS } from '../js/cards/glyphs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const L1 = data.boss.find((b) => b.size === 'M');
const mods = useExpansions(JSON.parse(readFileSync(join(root, 'data/expansions.json'), 'utf8')));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const basic = (over = {}) => newFight(data, {
  level: 1, boss: L1, noSignatures: true,
  hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: data.attack },
  die: 'd20', mode: 'standard', ...over,
});
const att = (f, id) => legalAttacks(f).find((a) => a.id === id);

// ── The five rules of a Mark ─────────────────────────────────

test('rule 4: the same Mark twice does not stack, it refreshes', () => {
  const f = basic();
  assert.equal(applyMark(f, 'hero', 'poison'), true, 'the first one is new');
  assert.equal(applyMark(f, 'hero', 'poison'), false, 'the second one is a refresh, not a second mark');
  assert.equal(Object.keys(f.hero.marks).length, 1);
  assert.equal(tickMarks(f.hero).damage, 25, 'and it still ticks for exactly one card');
});

test('rule 5: every Mark is small, and Charged is the only named exception', () => {
  // This assertion used to read `bonus <= 50`, which was written to PASS rather
  // than to enforce the rule the rulebook states. An adversarial review caught
  // that Charged is 50 while three files claimed no Mark exceeds 25. The rule is
  // now stated honestly and this checks the honest version: exactly one Mark may
  // carry a bonus at all, it must be Charged, and it must cost a whole action.
  const withBonus = MARK_IDS.filter((id) => MARKS[id].bonus);
  assert.deepEqual(withBonus, ['charged'], 'only Charged may exceed a single unit, by name');
  assert.equal(MARKS.charged.bonus, 50);
  for (const id of MARK_IDS) {
    const d = MARKS[id];
    assert.ok((d.damage || 0) <= 25, `${id} ticks for ${d.damage}, over the 25 cap`);
    assert.ok(Math.abs(d.step || 0) <= 1, `${id} shifts ${d.step} rungs`);
  }
  // And the caps hold even if every mark in the game lands on one figure at once.
  const fig = {};
  for (const id of MARK_IDS) addMark(fig, id);
  assert.ok(Math.abs(markStep(fig)) <= 1, 'a pile of marks still shifts at most one rung');
  assert.equal(markBonus(fig), 50, 'and adds at most one Charge');
});

test('every Mark ends by a route the engine actually implements', () => {
  // A mark with an `ends` nobody fires is a mark that never goes away, and it
  // would look exactly like a working mark until someone played a long fight.
  const handled = new Set(['action', 'hide', 'hit', 'guard', 'tick', 'turn']);
  for (const id of MARK_IDS) {
    const d = MARKS[id];
    assert.ok(handled.has(d.ends), `${id} ends on "${d.ends}", which nothing clears`);
    assert.ok(d.ticks === 'round' || d.ticks === null, `${id} ticks on "${d.ticks}"`);
    assert.ok(d.brick && d.name && d.text, `${id} is missing a table-facing field`);
  }
});

// ── What each Mark does ──────────────────────────────────────

test('Poison ticks AFTER Recover, so it costs a card you could have bet', () => {
  const f = basic();
  applyMark(f, 'hero', 'poison');
  startRound(f);
  // The whole design: Recover stands the pool up, then poison spends one, so
  // this round is fought with three cards instead of four. Ticking at the end
  // of the turn instead would have been very nearly free.
  assert.deepEqual([ready(f), spent(f), broken(f)], [3, 1, 0]);
  assert.ok(f.log.some((l) => /marks cost you 25/.test(l.text)), 'and it says so');
  startRound(f);
  assert.deepEqual([ready(f), spent(f), broken(f)], [3, 1, 0], 'it keeps costing until shaken');
});

test('Poison breaks cards only once there is nothing left to Spend', () => {
  const f = basic();
  applyMark(f, 'hero', 'poison');
  for (const c of f.hero.pool) c.st = 'broken';
  f.hero.pool[0].st = 'ready';
  startRound(f);
  assert.equal(broken(f), 3, 'the healthy hero is taxed; the dying one is not spared');
  assert.equal(spent(f), 1);
});

test('spending an action shakes off Poison and Snared together', () => {
  const f = basic();
  applyMark(f, 'hero', 'poison');
  applyMark(f, 'hero', 'snared');
  assert.equal(canShake(f), true);
  const gone = shake(f);
  assert.deepEqual(gone.map((d) => d.id).sort(), ['poison', 'snared']);
  assert.equal(f.actionsLeft, 2, 'and it cost one action');
  assert.equal(canShake(f), false, 'nothing left to shake');
  assert.throws(() => shake(f), /nothing to shake/);
});

test('Burning fires once and goes out; Hiding puts it out before it fires', () => {
  const f = basic();
  applyMark(f, 'hero', 'burning');
  startRound(f);
  assert.equal(spent(f), 1, 'it burned for 25');
  assert.equal(hasMark(f.hero, 'burning'), false, 'and then went out on its own');

  const g = basic({ biome: { id: 'forest' } });
  applyMark(g, 'hero', 'burning');
  hide(g);
  assert.equal(hasMark(g.hero, 'burning'), false, 'cover smothers it');
  startRound(g);
  assert.equal(spent(g), 0, 'so it never burned at all');
});

test('Snared stops you running and hiding, and stops the boss bracing', () => {
  const f = basic({ biome: { id: 'forest' } });
  applyMark(f, 'hero', 'snared');
  assert.throws(() => hide(f), /Snared/);
  const run = att(f, 'run');
  if (run) assert.throws(() => attack(f, run, {}), /Snared/);

  const g = basic();
  applyMark(g, 'body', 'snared');
  g.phase = 'boss';
  const p = bossRoll(g, 1);            // a 1 is Brace on the shared table
  assert.equal(p.kind, 'strike', 'a Brace it cannot make becomes a Strike');
  assert.equal(p.name, 'Strike', 'and it is named honestly in the log');
  assert.ok(p.dmg > 0);
});

test('Frozen costs the hero one action, exactly once', () => {
  const f = basic();
  applyMark(f, 'hero', 'frozen');
  startRound(f);
  assert.equal(f.actionsLeft, 2);
  assert.equal(hasMark(f.hero, 'frozen'), false, 'spent in the same breath');
  startRound(f);
  assert.equal(f.actionsLeft, 3, 'and the round after is whole again');
});

test('Frozen costs the boss its whole action, exactly once', () => {
  const f = basic();
  applyMark(f, 'body', 'frozen');
  f.phase = 'boss';
  const p = bossRoll(f, 6);            // a 6 is Ruin: the worst roll in the game
  assert.equal(p.kind, 'frozen');
  assert.equal(p.dmg, 0, 'Ruin included: Frozen is Barrier-strength on purpose');
  resolveBoss(f);
  assert.equal(ready(f), 4, 'nothing was guarded because nothing was thrown');
  f.phase = 'boss';
  assert.equal(bossRoll(f, 6).kind, 'ruin', 'and the next round it acts again');
});

test('Marked makes the next attack one rung easier, and ends when one lands', () => {
  const f = basic();
  const allIn = att(f, 'all-in');
  assert.equal(effectiveStep(f, allIn), 'even');
  applyMark(f, 'body', 'marked');
  assert.equal(effectiveStep(f, allIn), 'sure', 'one rung, on the ladder the aid card prints');
  attack(f, allIn, { bet: 1, u: 0 });  // u below the odds: it lands
  assert.equal(hasMark(f.boss, 'marked'), false, 'the opening is used up');
  assert.equal(effectiveStep(f, att(f, 'all-in')), 'even');
});

test('Charged adds 50 to the next landed attack and is spent by it', () => {
  const f = basic();
  const strike = att(f, 'strike');
  const plain = attackDamage(f, strike, 0);
  applyMark(f, 'hero', 'charged');
  assert.equal(attackDamage(f, strike, 0), plain + 50);
  attack(f, strike, { u: 0 });
  assert.equal(hasMark(f.hero, 'charged'), false);
  assert.equal(attackDamage(f, att(f, 'strike'), 0), plain, 'back to normal');
});

test('Charged is lost the moment you guard, whoever made you guard', () => {
  const f = basic();
  applyMark(f, 'hero', 'charged');
  take(f, 25, false);
  assert.equal(hasMark(f.hero, 'charged'), false);
  assert.ok(f.log.some((l) => /Charge is lost/.test(l.text)));
  // Including a guard forced by a Mark, which is deliberate: the alternative is
  // a second rule about which guards are real guards.
  const g = basic();
  applyMark(g, 'hero', 'charged');
  applyMark(g, 'hero', 'poison');
  startRound(g);
  assert.equal(hasMark(g.hero, 'charged'), false);
});

// ── Marks on the other side of the table ─────────────────────

test('a Mark can fell the boss, and the ground gets the credit', () => {
  // This test used to assert that a poisoned boss bleeds on consecutive rounds,
  // which was the BUG (an enemy could never shake a Mark off) written down as
  // an expectation. A Mark on an enemy bites once per application.
  const f = basic();
  applyMark(f, 'body', 'poison');
  const before = f.boss.body;
  startRound(f);
  assert.equal(f.boss.body, before - 25, 'the ground did that, not you');

  const g = basic();
  g.boss.body = 25;
  applyMark(g, 'body', 'poison');
  startRound(g);
  assert.equal(bossDown(g), true, 'and 25 is 25 wherever it comes from');
  assert.equal(g.phase, 'won');
});

test('a felling tick on one minion does not skip the next', () => {
  // The loop runs back to front precisely so a splice cannot shift an index
  // that has not ticked yet. Front to back, the second minion here is missed.
  const f = basic();
  f.boss.minions = [{ hp: 25, max: 200, marks: {} }, { hp: 200, max: 200, marks: {} }];
  applyMark(f, 0, 'poison');
  applyMark(f, 1, 'poison');
  startRound(f);
  assert.equal(f.boss.minions.length, 1, 'the 25 one died to its own poison');
  assert.equal(f.boss.minions[0].hp, 175, 'and the survivor still took its 25');
});

test('the hero can be felled by a Mark, and Second Wind still catches it', () => {
  const f = basic({ secondWind: true });
  applyMark(f, 'hero', 'poison');
  for (const c of f.hero.pool) c.st = 'broken';
  startRound(f);
  assert.equal(f.phase, 'down', 'not lost: the comeback is still on the table');
  assert.deepEqual(f.fell, { at: 'marks', left: 0 }, 'and the runner knows where it fell');
});

// ── The base game is untouched ───────────────────────────────

test('legacy refuses a Mark outright, so the balance table cannot move', () => {
  const f = basic({ legacy: true });
  assert.equal(applyMark(f, 'hero', 'poison'), false);
  assert.equal(applyMark(f, 'body', 'frozen'), false);
  assert.deepEqual(f.hero.marks, {});
  assert.deepEqual(f.boss.marks, {});
  startRound(f);
  assert.equal(ready(f), 4, 'nothing ticked');
});

test('a fight that never places a Mark is arithmetically the fight it always was', () => {
  const f = basic();
  const strike = att(f, 'strike');
  assert.equal(attackDamage(f, strike, 0), 25, 'Strike is still 25');
  assert.equal(effectiveStep(f, att(f, 'all-in')), 'even', 'All In is still Even');
  assert.equal(markStep(f.boss), 0);
  assert.equal(markBonus(f.hero), 0);
  assert.equal(tickMarks(f.hero).damage, 0);
  startRound(f);
  assert.deepEqual([ready(f), spent(f), broken(f)], [4, 0, 0]);
});

test('a run saved before Marks existed comes back with none, rather than throwing', () => {
  const f = basic();
  delete f.hero.marks; delete f.boss.marks;
  f.boss.minions = [{ hp: 200, max: 200 }];   // no marks key either
  assert.equal(hasMark(f.hero, 'poison'), false);
  assert.deepEqual(listMarks(f.boss), []);
  startRound(f);                               // the tick path must survive it
  endTurn(f);
  assert.equal(f.phase, 'boss');
  assert.equal(applyMark(f, 'hero', 'poison'), true, 'and a mark can still be placed after');
});

test('figureAt names the boss and each minion, and nothing else', () => {
  const f = basic();
  f.boss.minions = [{ hp: 200, max: 200, marks: {} }];
  assert.equal(figureAt(f, 'body'), f.boss);
  assert.equal(figureAt(f, 0), f.boss.minions[0]);
  assert.equal(figureAt(f, 9), undefined, 'a minion that is not there is not a figure');
  assert.equal(applyMark(f, 9, 'poison'), false, 'and marking it is a no-op, not a crash');
});

// ── The terrain module's content ─────────────────────────────

test('every hazard and every biome object names a Mark that exists', () => {
  const t = moduleOf(mods, 'terrain');
  assert.ok(t, 'the terrain module is in data/expansions.json');
  assert.equal(hazards(mods).length, 8);
  for (const h of hazards(mods)) {
    assert.ok(MARKS[h.mark], `hazard ${h.id} gives "${h.mark}", which is not a Mark`);
    assert.ok(h.name && h.flavour, `hazard ${h.id} is missing table-facing copy`);
  }
  for (const o of t.biome_object) {
    for (const m of [o.target_mark, o.self_mark]) {
      if (m) assert.ok(MARKS[m], `object ${o.id} gives "${m}", which is not a Mark`);
    }
  }
});

test('the four biome objects fill exactly the four biomes that had no rule', () => {
  // The whole reason this part of M1 costs nothing to print: a biome face
  // carries no text, so a rule can be added to a deck someone already owns.
  const blank = data.biome.filter((b) => !b.rule).map((b) => b.id).sort();
  const objects = moduleOf(mods, 'terrain').biome_object.map((o) => o.biome).sort();
  assert.deepEqual(objects, blank, 'an object for each blank biome, and no others');
  for (const b of data.biome) {
    const o = objectFor(mods, b.id);
    assert.equal(!!o, !b.rule, `${b.id}: a biome may have a rule or an object, never both`);
  }
});

test('an object is one action, once a level, and the engine says so twice', () => {
  const f = basic({ biome: { id: 'volcano', element: 'fire' } });
  const vent = objectFor(mods, 'volcano');
  assert.equal(canUseObject(f, vent), true);
  const before = f.boss.body;
  const r = useObject(f, vent);
  assert.equal(r.damage, 50);
  assert.equal(f.boss.body, before - 50);
  assert.equal(hasMark(f.boss, 'burning'), true);
  assert.equal(f.actionsLeft, 2, 'it cost one action');
  assert.equal(canUseObject(f, vent), false, 'and it is spent for the level');
  assert.throws(() => useObject(f, vent), /spent for this level/);
});

test('Rockfall costs you something too, which is what makes it a bet', () => {
  const f = basic({ biome: { id: 'mountain', element: 'earth' } });
  const rock = objectFor(mods, 'mountain');
  const before = f.boss.body;
  useObject(f, rock);
  assert.equal(f.boss.body, before - 75);
  assert.equal(hasMark(f.hero, 'snared'), true, 'the scree comes down on you as well');
  // Outside the Forest, hiding is what the Run card buys you, and Snared stops
  // that too. Both doors, because a rule that closes one is not a rule.
  assert.throws(() => attack(f, att(f, 'run'), {}), /Snared/);
  assert.throws(() => hide(f), /Snared/, 'and the Forest door reports the real reason');
});

test('the River sweeps the boss off its feet, which is Frozen by another name', () => {
  const f = basic({ biome: { id: 'river', element: 'water' } });
  useObject(f, objectFor(mods, 'river'));
  assert.equal(hasMark(f.boss, 'frozen'), true);
  f.phase = 'boss';
  assert.equal(bossRoll(f, 6).kind, 'frozen', 'a Ruin it never gets to throw');
});

test('a felling object does not leave a Mark on a boss that is gone', () => {
  const f = basic({ biome: { id: 'volcano', element: 'fire' } });
  f.boss.body = 25;
  f.boss.minions = [{ hp: 200, max: 200, marks: {} }];
  useObject(f, objectFor(mods, 'volcano'));
  assert.equal(f.phase, 'won');
  assert.equal(f.boss.minions.length, 0, 'and its minions scattered');
});

test('legacy has never heard of an object', () => {
  const f = basic({ legacy: true, biome: { id: 'volcano', element: 'fire' } });
  const vent = objectFor(mods, 'volcano');
  assert.equal(canUseObject(f, vent), false);
  assert.throws(() => useObject(f, vent), /expansion/);
});

test('drawHazard picks one and never falls off either end of the deck', () => {
  assert.equal(drawHazard(mods, 0).id, hazards(mods)[0].id);
  assert.equal(drawHazard(mods, 0.9999).id, hazards(mods)[7].id);
  assert.equal(drawHazard(mods, 1).id, hazards(mods)[7].id, 'a uniform that returns exactly 1 is still in the deck');
  assert.equal(drawHazard({ byId: {} }, 0.5), null, 'and no module means no hazard, not a crash');
});


test('every expansion card names a glyph that exists and is not shared with another', () => {
  // The deck's rule is that the picture IS the name: a card carries no text, so
  // two cards sharing a drawing are two cards a player cannot tell apart. This
  // caught a real collision: the first Thorn Nest was a radiating burr and the
  // first Open Ground a radiating sun, and at 30 mm they were the same picture.
  const t = moduleOf(mods, 'terrain');
  const used = new Map();
  const claim = (icon, who) => {
    assert.ok(icon, `${who} names no glyph`);
    assert.ok(hasGlyph(icon), `${who} names "${icon}", which is not a glyph`);
    assert.equal(used.has(icon), false, `${who} and ${used.get(icon)} share the drawing "${icon}"`);
    used.set(icon, who);
  };
  for (const id of MARK_IDS) claim(MARKS[id].icon, `mark ${id}`);
  for (const h of t.hazard) claim(h.icon, `hazard ${h.id}`);
  assert.equal(used.size, MARK_IDS.length + t.hazard.length, 'one drawing per card');
  // A biome object rides its biome's OWN card, so it deliberately reuses that
  // glyph rather than claiming a new one.
  for (const o of t.biome_object) {
    assert.ok(hasGlyph(o.icon), `object ${o.id} names "${o.icon}", which is not a glyph`);
  }
});

test('every new glyph fits the 24x24 grid and is drawn, not empty', () => {
  const ids = [...MARK_IDS.map((id) => MARKS[id].icon), ...moduleOf(mods, 'terrain').hazard.map((h) => h.icon)];
  for (const id of ids) {
    const d = GLYPHS[id].d;
    assert.match(d, /^M/, `${id} does not start with a move`);
    assert.ok(d.length > 40, `${id} is too simple to read as anything`);
    assert.ok(GLYPHS[id].label, `${id} has no label`);
    // Absolute coordinates only; relative deltas are legitimately negative, so
    // this checks the commands that place a pen rather than every number.
    for (const m of d.matchAll(/[ML]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)) {
      for (const n of [Number(m[1]), Number(m[2])]) {
        assert.ok(n >= 0 && n <= 24, `${id} places a point at ${n}, outside the 24 grid`);
      }
    }
  }
});


test('every card the module prints has a face, and no face carries a word', () => {
  const cards = moduleCards(mods);
  assert.equal(cards.length, 14, '6 Marks and 8 Hazards');
  assert.equal(moduleSheets(mods), moduleOf(mods, 'terrain').sheets,
    'the sheet count the setup screen shows must be the one the deck actually costs');
  for (const c of cards) {
    const svg = cardFace(c, { size: 'sheet' });
    assert.match(svg, /<path/, `${c.id}: renders no picture at all`);
    assert.equal(/<text/.test(svg), false, `${c.id}: a card face may carry no text (RULES.md section 10)`);
    assert.match(svg, /viewBox="0 0 630 880"/, `${c.id}: not the printed card's shape`);
  }
});

test('a Mark card is built from the engine, so the print cannot disagree with the rule', () => {
  // The worst kind of bug in a print-and-play: the table believes the card.
  // Mark cards are generated from js/game/marks.js rather than stored, so a
  // rule change reaches the printer by construction.
  const printed = moduleCards(mods).filter((c) => c.deck === 'mark');
  assert.deepEqual(printed.map((c) => c.id), MARK_IDS);
  for (const c of printed) {
    assert.equal(c.text, MARKS[c.id].text, `${c.id}: the printed card and the engine disagree`);
    assert.equal(c.hex, MARKS[c.id].hex);
    assert.ok(c.brick, `${c.id}: no brick colour for the table to match`);
  }
});

test('a Hazard card shows the Mark it gives, in that Mark\'s own colour', () => {
  for (const c of moduleCards(mods).filter((x) => x.deck === 'hazard')) {
    assert.equal(c.markIcon, MARKS[c.mark].icon, `${c.id}: shows the wrong Mark`);
    assert.equal(c.markHex, MARKS[c.mark].hex);
    const svg = cardFace(c, { size: 'sheet' });
    assert.ok(svg.includes(c.markHex), `${c.id}: the Mark stud is not painted in the Mark's colour`);
  }
});


test('no expansion card ever leaks into the frozen 111', () => {
  // The hard constraint of the whole expansion plan. Decks have been sent to a
  // printing service, so `physical` must keep meaning exactly the base box, and
  // every count test in the suite depends on that. A module card that appeared
  // here would change what "print all" prints for someone who owns the base deck.
  assert.equal(data.physical.length, 111);
  const baseIds = new Set(data.physical.map((c) => c.id));
  for (const c of moduleCards(mods)) {
    assert.equal(baseIds.has(c.id), false, `expansion card ${c.id} collides with a base card id`);
    assert.equal(data.byId[c.id], undefined, `expansion card ${c.id} is indexed as a base card`);
  }
  // And the module's own decks are not in the base DECKS allowlist, which is
  // the mechanism that keeps them out rather than a convention that might slip.
  for (const deck of ['mark', 'hazard']) {
    assert.equal(DECKS.includes(deck), false, `"${deck}" is in the base deck list, so it would be counted into physical`);
  }
});


test('a face-down expansion pile says which pile it is', () => {
  // RULES.md section 10: each pile carries the picture of what it is, so four
  // face-down piles are four different piles. Both new decks fell through to
  // the book back, which claimed a stack of hazards was skills to learn.
  for (const c of moduleCards(mods)) {
    assert.equal(backKind(c), 'biome',
      `${c.deck} ${c.id} takes the "${backKind(c)}" back; a place and a brick both want bricks`);
  }
});


test('the Charge is lost the moment damage costs a card, however it costs it', () => {
  // Three ways to pay, and the first build only noticed the first one. `used`
  // counted Ready -> Spent alone, so a hero with nothing Ready paid by BREAKING
  // a card and kept the Charge, and under Rage cards break with no guard at all.
  // Both left a player who had just been hit still holding what they were told
  // they would lose.
  const guarded = basic();
  applyMark(guarded, 'hero', 'charged');
  take(guarded, 25, false);
  assert.equal(hasMark(guarded.hero, 'charged'), false, 'a plain guard spends it');

  const broke = basic();
  applyMark(broke, 'hero', 'charged');
  for (const c of broke.hero.pool) c.st = 'spent';      // nothing Ready to guard with
  take(broke, 25, false);
  assert.equal(broken(broke), 1, 'the hit broke a card, which is paying for it');
  assert.equal(hasMark(broke.hero, 'charged'), false, 'so the Charge goes too');

  const raged = basic();
  applyMark(raged, 'hero', 'charged');
  take(raged, 25, true);                                 // Rage: unguardable
  assert.equal(broken(raged), 1);
  assert.equal(hasMark(raged.hero, 'charged'), false, 'Rage breaks cards, and the Charge with them');

  // And damage too small to cost anything leaves it alone.
  const grazed = basic();
  applyMark(grazed, 'hero', 'charged');
  take(grazed, 0, false);
  assert.equal(hasMark(grazed.hero, 'charged'), true, 'nothing turned over, nothing lost');
});


test('an enemy shakes off Poison and Snared with its turn, since it has no actions', () => {
  // Without this they were permanent on a boss: "spend an action to shake it
  // off" is unspendable by something that takes no actions, so one shove into a
  // tar pit bled 25 a round for the rest of the fight, free. And a Snared boss
  // could never clear it, because bracing is the thing Snared forbids.
  const f = basic();
  applyMark(f, 'body', 'poison');
  applyMark(f, 'body', 'snared');
  const before = f.boss.body;
  startRound(f);
  assert.equal(f.boss.body, before - 25, 'it bites once');
  assert.equal(hasMark(f.boss, 'poison'), false, 'and then the boss shakes it off');
  assert.equal(hasMark(f.boss, 'snared'), false);
  const after = f.boss.body;
  startRound(f);
  assert.equal(f.boss.body, after, 'so it does not bleed forever');

  // A minion shakes its own off too, and the hero's are untouched by any of it.
  const g = basic();
  g.boss.minions = [{ hp: 200, max: 200, marks: {} }];
  applyMark(g, 0, 'poison');
  applyMark(g, 'hero', 'poison');
  startRound(g);
  assert.equal(hasMark(g.boss.minions[0], 'poison'), false, 'the minion shook it off');
  assert.equal(hasMark(g.hero, 'poison'), true, 'the hero still has to spend an action');
});

test('a Mark eases at most one rung, and never into an automatic hit', () => {
  // shiftStep('sure', -1) returns null and attack() reads a null step as "always
  // lands", so a Marked boss made every Sure attack unmissable. That is not one
  // rung, it is unbounded, and it broke the Mark's own rule 5.
  const f = basic();
  const focus = att(f, 'focus');
  assert.equal(effectiveStep(f, focus), 'sure');
  applyMark(f, 'body', 'marked');
  assert.equal(effectiveStep(f, focus), 'sure', 'eased off the easiest rung, it STAYS on it');
  assert.notEqual(effectiveStep(f, focus), null, 'a Mark may never delete the check');
});

test('an attack reads the marks on what it is actually swinging at', () => {
  // effectiveStep defaulted to the body while applyHit spent the mark on
  // o.target, so swinging at a minion consulted the boss and vice versa.
  const f = basic();
  f.boss.minions = [{ hp: 200, max: 200, marks: {} }];
  const allIn = att(f, 'all-in');
  applyMark(f, 0, 'marked');
  assert.equal(effectiveStep(f, allIn, 0), 'sure', 'the minion is Marked');
  assert.equal(effectiveStep(f, allIn, 'body'), 'even', 'the boss is not');
  attack(f, allIn, { bet: 1, u: 0, target: 0 });
  assert.equal(hasMark(f.boss.minions[0], 'marked'), false, 'and the hit spends the minion\'s mark');
});


console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
