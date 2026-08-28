// Contracts C1 and C2 plus the component count, run with `node tests/cards.test.mjs`.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards, DECKS } from '../js/data/cards.js';
import { GLYPHS, hasGlyph, setArtManifest, artSrc, loadArt, artBody, clearArtBodies } from '../js/cards/glyphs.js';
import { cardFace, cardBack, lifeMini } from '../js/cards/face.js';
import { aidFor } from '../js/game/rules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const manifest = JSON.parse(readFileSync(join(root, 'data/art-manifest.json'), 'utf8'));

// The browser fetches the art over HTTP; here we hand loadArt a disk reader so
// the tests exercise the same inlining path the printed card goes through.
const loadArtFromDisk = () => {
  setArtManifest(manifest);
  clearArtBodies();
  return loadArt(async (url) => (existsSync(join(root, url)) ? readFileSync(join(root, url), 'utf8') : null));
};

// Queued and awaited, not called on the spot. The old runner called fn() inside
// a try and counted a pass the moment it returned, so an `async` test scored a
// pass for returning a Promise and its assertions were never waited on: one
// test in this file was already async and had not really been running.
let passed = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

test('105 physical cards, matching the component table in RULES.md section 10', () => {
  // 90, then Bubble and Second Wind after the first playtest, then the Boss
  // Reactions and Damage Track aids after the second (all 2026-08-27). Then, on
  // 2026-08-28, Run, and ten more boss life cards: making every boss card worth
  // 100 took the level 5 pile from 10 cards to 20.
  assert.equal(data.physical.length, 105);
  const per = Object.fromEntries(DECKS.map((d) => [d, (data[d] || []).reduce((a, c) => a + (c.copies || 1), 0)]));
  assert.deepEqual(per, { attack: 5, skill: 25, class: 4, advantage: 12, boss: 6, biome: 7, life: 41, mode: 1, aid: 4 });
  // The printed pile has to be able to hold the biggest boss, or level 5 runs
  // out of cards halfway through the fight it is the climax of.
  const bossLife = data.life.find((c) => c.id === 'life-boss');
  assert.ok(bossLife.copies >= Math.max(...data.boss.map((b) => b.life_cards)),
    'fewer boss life cards printed than the largest boss needs');
});

/**
 * The components table in RULES.md is prose, and prose drifts. It has now been
 * wrong twice in the same way: it summed to 93 under a stated 94, and after the
 * rewrite to 105 it summed to 104. Both times the missing row was Second Wind.
 * RULES.md itself claims the table is "checkable rather than remembered", which
 * was not true of anything in the repo until this test. Now it is.
 */
test('the components table in RULES.md sums to its own total, and to the deck', () => {
  const rules = readFileSync(join(root, 'RULES.md'), 'utf8');
  const table = /\| Deck \| Cards \|[\s\S]*?\| \*\*Total\*\* \| \*\*(\d+)\*\* \|/.exec(rules);
  assert.ok(table, 'the components table is still in RULES.md');
  const rows = [...table[0].matchAll(/^\| (?!\*\*Total)([^|]+?) \| (\d+) \|$/gm)];
  assert.ok(rows.length >= 8, `expected the full table, parsed ${rows.length} rows`);
  const sum = rows.reduce((a, r) => a + Number(r[2]), 0);
  assert.equal(sum, Number(table[1]), 'the rows must add up to the printed total');
  assert.equal(sum, data.physical.length, 'and the total must be the deck in cards.json');
});

test('C2: every card icon resolves to a glyph', () => {
  const missing = data.physical.filter((c) => c.icon && !hasGlyph(c.icon)).map((c) => `${c.id}->${c.icon}`);
  assert.deepEqual([...new Set(missing)], []);
});

test('C2: every art-manifest slot has a glyph of the same id (the swap contract)', () => {
  // Card backs are the exception: no card asks for them by icon, and cardBack()
  // draws its own fallback ring when the art is absent.
  const missing = manifest.slots.filter((s) => !s.id.startsWith('back-') && !hasGlyph(s.id)).map((s) => s.id);
  assert.deepEqual(missing, []);
});

test('C2: an art slot counts only when creator AND licence are filled', () => {
  setArtManifest({ slots: [
    { id: 'fire', source: 'http://x', creator: 'A', licence: 'CC BY' },
    { id: 'water', source: 'http://x', creator: 'A', licence: null },
    { id: 'earth', source: null, creator: null, licence: null },
  ] });
  assert.equal(artSrc('fire'), 'art/fire.svg');
  assert.equal(artSrc('water'), null);
  assert.equal(artSrc('earth'), null);
  setArtManifest(manifest);
});

test('every attributed slot has its file on disk (a licence without a file renders a broken image)', () => {
  // artSrc() serves art/<id>.svg the moment a slot carries creator AND licence,
  // so filling a licence ahead of its download breaks every card asking for it.
  const attributed = manifest.slots.filter((s) => s.creator && s.licence).map((s) => s.id);
  assert.ok(attributed.length > 0, 'expected the downloaded set to be attributed');
  const missing = attributed.filter((id) => !existsSync(join(root, 'art', `${id}.svg`)));
  assert.deepEqual(missing, [], 'attributed but no file');
  // And the reverse: a file nobody declared would never be served.
  const declared = new Set(manifest.slots.map((s) => s.id));
  const orphans = readdirSync(join(root, 'art'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.replace(/\.svg$/, ''))
    .filter((id) => !declared.has(id));
  assert.deepEqual(orphans, [], 'file present but no manifest slot');
});

test('card art carries no baked-in credit line and is cropped square', () => {
  // The download bakes "Created by Maxicons" into a 512x640 box. On a card that
  // would print the credit across the face, so it is stripped and CREDITS.md
  // carries it instead. art/original/ keeps the untouched download.
  const files = readdirSync(join(root, 'art')).filter((f) => f.endsWith('.svg'));
  const bad = files.filter((f) => {
    const svg = readFileSync(join(root, 'art', f), 'utf8');
    return svg.includes('<text') || svg.includes('512 640');
  });
  assert.deepEqual(bad, []);
  assert.ok(existsSync(join(root, 'art', 'original', files[0])), 'originals are preserved');
});

test('every glyph path parses as SVG path data (only path commands and numbers)', () => {
  const bad = Object.entries(GLYPHS).filter(([, g]) => !/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/.test(g.d)).map(([id]) => id);
  assert.deepEqual(bad, []);
});

test('C1: every card renders, and the only text on a face is a numeral, a pip count or a permitted symbol', () => {
  const aid = aidFor(data);
  const offenders = [];
  for (const c of data.physical) {
    const svg = cardFace(c, { size: 'sheet', aid });
    assert.ok(svg.startsWith('<svg'), `${c.id} did not render`);
    assert.ok(svg.includes('viewBox="0 0 630 880"'), `${c.id} wrong grid`);
    if (c.deck === 'aid') continue; // the four player aids are reference cards and carry labels
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    // Boss cards state their size as a code (S, M, L, XL, UM): the rulebook
    // asks for it and it is a label, not prose. Nothing else may carry letters.
    const allowed = c.deck === 'boss' ? /^([0-9×+]+|S|M|L|XL|UM)$/ : /^[0-9×+]+$/;
    for (const txt of texts) if (!allowed.test(txt)) offenders.push(`${c.id}: "${txt}"`);
  }
  assert.deepEqual(offenders, []);
});

test('the Boss Reactions aid draws the rows cards.json states, not a copy of them', () => {
  const c = data.byId['aid-boss'];
  const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  const real = texts(cardFace(c, { size: 'sheet', aid: aidFor(data) }));
  for (const r of data.boss_reaction) {
    const label = Array.isArray(r.roll) ? `${r.roll[0]}-${r.roll[r.roll.length - 1]}` : String(r.roll);
    assert.ok(real.includes(label), `roll ${label} is on the card`);
    assert.ok(real.includes(r.name), `${r.name} is on the card`);
  }
  // The point of drawing from the data: a rulebook that changes a row changes the
  // printed aid with it. A face that ignored its rows would pass the check above
  // by carrying the same five names hardcoded here.
  const stub = texts(cardFace(c, { size: 'sheet', aid: { ladder: aidFor(data).ladder, reactions: [{ roll: 6, name: 'Ruin' }] } }));
  assert.deepEqual(stub, ['6', 'Ruin'], 'one row in, one row out');
});

test('the Boss Reactions aid prints the names in the language it is handed', () => {
  // The board said "Brace" while the Spanish rulebook said "Aguante", so the
  // same term reached the same player two different ways. The renderer takes a
  // map rather than importing the string table, because face.js is shared with
  // the print path and the node tests, neither of which sets a language.
  const texts = (aid) => [...cardFace(data.byId['aid-boss'], { size: 'sheet', aid }).matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m) => m[1]).filter((x) => /[A-Za-z]/.test(x));
  assert.deepEqual(texts(aidFor(data)), ['Brace', 'Strike', 'Summon', 'Roar', 'Ruin'], 'no map means the data\'s own names');
  const es = { brace: 'Aguante', strike: 'Golpe', summon: 'Invocacion', roar: 'Rugido', ruin: 'Ruina' };
  assert.deepEqual(texts(aidFor(data, es)), Object.values(es), 'a map renames every row');
  // Every row must be reachable by id, or a rename silently falls back.
  for (const r of data.boss_reaction) assert.ok(r.id && es[r.id], `${r.name} has no id the map can key on`);
});

test('the Damage Track aid draws four bands and the hundreds box', () => {
  const svg = cardFace(data.byId['aid-track'], { size: 'sheet', aid: aidFor(data) });
  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(texts, ['25', '50', '75', '100', '×100'], 'the four bands, then the die box');
  // Five footprints, one per band plus the die's: a band with nowhere to stand a
  // brick is a number, not a track.
  assert.equal((svg.match(/stroke-dasharray/g) || []).length, 5);
});

const betPips = (svg) => (svg.match(/pip--bet/g) || []).length;
const riskPips = (svg) => (svg.match(/pip--risk/g) || []).length;

test('C1: the four corners carry what the layout doc says they carry (spot checks)', () => {
  setArtManifest({ slots: [] });   // grammar test: draw glyphs, not the art files
  const focus = cardFace(data.byId.focus, { size: 'sheet' });
  assert.equal(betPips(focus), 1, 'Focus: one bet pip top-left');
  assert.equal(riskPips(focus), 1, 'Focus: one Sure pip top-right');
  assert.ok(/>75<\/text>/.test(focus), 'Focus: damage 75 bottom-right');
  const allIn = cardFace(data.byId['all-in'], { size: 'sheet' });
  assert.equal((allIn.match(/pip--ghost/g) || []).length, 3, 'All In: a fanned stack means any number');
  assert.ok(!/pip--bet"/.test(allIn), 'All In: a fan, never a countable row');
  assert.equal((allIn.match(/<rect class="frame"/g) || []).length, 1, 'All In: doubled frame = 2 actions');
  assert.ok(/>×4<\/text>/.test(allIn), 'All In: ×4 (doubled 2026-08-27 after the first playtest)');
  const ice = cardFace(data.byId['ice-spear'], { size: 'sheet' });
  assert.ok(ice.includes('#2563eb'), 'Ice Spear: water colour');
  assert.ok(/translate\(52 7\d\d\)/.test(ice) && ice.includes('#7c3aed'), 'Ice Spear: class lock glyph in the bottom-left corner');
  assert.ok(/>1<\/text>/.test(ice) && ice.includes('#c6bdae'), 'Ice Spear: tier 1, demoted to grey and off the corner');
  const bubble = cardFace(data.byId.bubble, { size: 'sheet' });
  assert.ok(/fill="none" stroke="#1c1917"[^>]*>25<\/text>/.test(bubble), 'Bubble: 25 hollow, absorbed not dealt');
  assert.equal(betPips(bubble) + riskPips(bubble), 0, 'Bubble: no bet, no check');
  const strike = cardFace(data.byId.strike, { size: 'sheet' });
  assert.equal(betPips(strike) + riskPips(strike), 0, 'Strike: no pips at all, the simplest card');
  const lifeFire = cardFace(data.byId['life-fire'], { size: 'sheet' });
  assert.ok(lifeFire.includes('fill="#dc2626"') && />25<\/text>/.test(lifeFire), 'Fire life: red face + 25');
  const bossLife = cardFace(data.byId['life-boss'], { size: 'sheet' });
  assert.ok(bossLife.includes('fill="#111111"') && !/<text/.test(bossLife), 'Boss life: black, crown, no numeral');
  const boss5 = cardFace(data.byId['boss-um'], { size: 'sheet' });
  assert.ok(/>20×100<\/text>/.test(boss5) && />100<\/text>/.test(boss5) && />5<\/text>/.test(boss5), 'Level 5 boss: 20x100, dmg 100, rage 5');
  setArtManifest(manifest);
});

/**
 * The bet corner and the check corner used to be the same black dot, told apart
 * only by which corner it sat in. They are now different in shape AND colour,
 * and both halves of that have to survive a future edit: a change that made the
 * risk pips rectangles, or dropped the traffic light back to black, would undo
 * the readability fix without failing a single other test.
 */
test('every boss life card is worth exactly 100, and the counts match the totals', () => {
  // The uniform 100 is an ergonomic rule, not a cosmetic one: a child turns one
  // card over per 100 damage and never divides. One boss drifting back to 150
  // silently hands them the arithmetic again, so this is checked per boss.
  for (const b of data.boss) {
    assert.equal(b.per_card, 100, `${b.id}: every boss life card is 100`);
    assert.equal(b.life_cards * b.per_card, b.hp, `${b.id}: ${b.life_cards} cards must sum to its ${b.hp} hp`);
  }
});

test('C1: bet and check are different shapes, and check is on the traffic light', () => {
  setArtManifest({ slots: [] });
  const RAMP = { sure: '#16a34a', even: '#eab308', hard: '#f97316', wild: '#dc2626' };
  const PIP_COUNT = { sure: 1, even: 2, hard: 3, wild: 4 };
  for (const c of [...data.attack, ...data.skill]) {
    const svg = cardFace(c, { size: 'sheet' });
    if (typeof c.bet === 'number' && c.bet > 0) {
      assert.equal(betPips(svg), c.bet, `${c.id}: ${c.bet} bet pips`);
      assert.ok(/<rect class="pip pip--bet"/.test(svg), `${c.id}: bet pips are cards, not dots`);
    }
    if (!c.check) { assert.equal(riskPips(svg), 0, `${c.id}: no check, no risk pips`); continue; }
    assert.equal(riskPips(svg), PIP_COUNT[c.check], `${c.id}: ${c.check} is ${PIP_COUNT[c.check]} pips`);
    assert.ok(
      new RegExp(`<circle class="pip pip--risk"[^>]*fill="${RAMP[c.check]}"`).test(svg),
      `${c.id}: ${c.check} pips are circles in ${RAMP[c.check]}`,
    );
  }
  // The Dice Bridge aid is where a player learns the ramp, so it has to be
  // printed in the same four colours the cards are, not a monochrome copy.
  const aid = cardFace(data.byId['aid-checks'], { size: 'sheet', aid: aidFor(data) });
  for (const [step, colour] of Object.entries(RAMP)) {
    assert.ok(aid.includes(`fill="${colour}"`), `aid card teaches ${step} in ${colour}`);
  }
  setArtManifest(manifest);
});

/**
 * Colour is never the only channel (CARD-LAYOUT.md). A green-to-red ramp is the
 * classic way to fail a red-green colour-blind player, and it is only safe here
 * because the pip COUNT says the same thing. If a future edit ever collapses the
 * ramp to one pip per card, this fails and the ramp has to go with it.
 */
test('C1: the risk ramp is redundant, never the only channel', () => {
  setArtManifest({ slots: [] });
  const seen = new Map();
  for (const c of [...data.attack, ...data.skill]) {
    if (!c.check) continue;
    const n = riskPips(cardFace(c, { size: 'sheet' }));
    const prev = seen.get(c.check);
    assert.ok(prev === undefined || prev === n, `${c.check} must always be the same count`);
    seen.set(c.check, n);
  }
  const counts = [...seen.values()];
  assert.equal(new Set(counts).size, counts.length, 'two steps sharing a pip count would leave colour alone');
  setArtManifest(manifest);
});

test('every glyph id the UI asks for exists (glyphSvg returns "" for a typo, so a rename blanks an icon silently)', () => {
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      if (f.startsWith('neorgon-')) continue;                 // vendored kits
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p);
    }
  };
  walk(join(root, 'js'));
  const asked = new Map();                                     // id -> where
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const where = f.replace(root + '/', '');
    // glyphSvg('x') / glyph('x') / glyphPath('x'), and data fields: glyph: 'x',
    // plus the nav map's values, which are plain strings in an object literal.
    for (const m of src.matchAll(/glyph(?:Svg|Path)?\(\s*'([\w-]+)'/g)) asked.set(m[1], where);
    for (const m of src.matchAll(/\bglyph:\s*'([\w-]+)'/g)) asked.set(m[1], where);
    for (const m of src.matchAll(/NAV_ICON\s*=\s*\{([^}]*)\}/g))
      for (const v of m[1].matchAll(/'([\w-]+)'/g)) asked.set(v[1], where);
  }
  assert.ok(asked.size >= 8, `scanned ${asked.size} glyph references, expected the scan to find more`);
  const missing = [...asked].filter(([id]) => !hasGlyph(id)).map(([id, where]) => `${id} (${where})`);
  assert.deepEqual(missing, []);
});

test('art is INLINED, never filtered: a filter is correct on screen and black on paper', async () => {
  // This is the one that cost a printed deck. The art used to be an <image>
  // recoloured by an SVG filter. Chromium drops SVG filters when it rasterises
  // for print and for PDF, so the boss life card, a gold crown on a near-black
  // face, came out of the printer black on black: a blank card. Every browser
  // showed it correctly and the old test passed, because both were looking at
  // markup rather than at paper. Nothing on a card face may be filtered.
  await loadArtFromDisk();
  const boss = cardFace(data.byId['life-boss'], { size: 'sheet' });
  assert.ok(!boss.includes('<filter') && !boss.includes('filter="url('), 'no filter may reach a card face');
  assert.ok(!boss.includes('<image'), 'no linked image either: it cannot take a fill');
  assert.ok(/<g class="glyph-art"[^>]*fill="#eab308"/.test(boss), 'the crown is painted gold by an ordinary fill');
  const strike = cardFace(data.byId.strike, { size: 'sheet' });
  assert.ok(/<g class="glyph-art"[^>]*fill="#1c1917"/.test(strike), 'neutral art is painted in the neutral ink');
  // Nothing in an inlined file may pin its own colour, or the fill above loses.
  for (const [id] of Object.entries(manifest.slots.filter((s) => s.creator && s.licence))) void id;
  for (const s of manifest.slots.filter((s) => s.creator && s.licence)) {
    const body = artBody(s.id);
    if (!body) continue;
    assert.ok(!/<style/i.test(body.inner), `${s.id}: a <style> block would override the card's fill`);
    assert.ok(!/\sfill="(?!none)/.test(body.inner), `${s.id}: a hard-coded fill would override the card's fill`);
  }
});

test('the <image> fallback survives, for art that fails to load', () => {
  // loadArt is best-effort: a slow network or a missing file must show the art
  // in black rather than nothing at all. That path may still use the filter,
  // because it is the screen-only path by definition.
  clearArtBodies();
  setArtManifest({ slots: [{ id: 'crown', source: 'http://x', creator: 'A', licence: 'CC BY' }] });
  const withArt = cardFace(data.byId['life-boss'], { size: 'sheet' });
  assert.ok(withArt.includes('<image'), 'art should still be used once attributed');
  assert.ok(withArt.includes('flood-color="#eab308"'), 'and tinted, which is right on screen');
  setArtManifest(manifest);
});

test('the runner deals every Attack card in the deck (a hardcoded list once dropped Bubble)', async () => {
  const { newRun, attacksFor } = await import('../js/game/run.js');
  const run = newRun(data, { kind: 'full', element: 'fire' });
  const dealt = attacksFor(run, data).map((c) => c.id).sort();
  assert.deepEqual(dealt, data.attack.map((c) => c.id).sort());
  assert.ok(dealt.includes('bubble'));
});

test('backs and minis render', () => {
  assert.ok(cardBack().startsWith('<svg'));
  for (const k of ['fire', 'water', 'earth', 'wind', 'extra', 'boss']) assert.ok(lifeMini(k).includes('sk-card--mini'));
});

test('the pool back carries the emblem its own comment promises, in ink and never in words', () => {
  const back = cardBack('skill');
  // The 2x2 brick: one plate, its outline, and four studs, all on the centre of
  // the 630x880 grid. Two bare rings shipped here for a while and the Skills
  // pile on the board read as an unfinished card rather than a face-down one.
  assert.equal((back.match(/<circle[^>]*r="27"/g) || []).length, 4, 'four studs');
  assert.ok(back.includes('<rect x="231" y="356" width="168" height="168"'), 'the plate, centred');
  assert.ok(!/<text/.test(back), 'a back that needed a word would be a back that failed to say it');
  // Every colour inline: css/cards.css sizes cards and never paints them, which
  // is what the printer needs (declaring fill in CSS once printed them white).
  assert.ok(back.includes('#713f12'), 'the pool ink, stated in the SVG');
  // A life card's back is the break line, not the emblem: that is the printed
  // difference between "a card from a pile" and "a card off your life".
  assert.ok(!cardBack('boss').includes('<rect x="231" y="356"'), 'a life back keeps its break line');
});

for (const [name, fn] of queue) {                 // in declaration order: they share module state
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
