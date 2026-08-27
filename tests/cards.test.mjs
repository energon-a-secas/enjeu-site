// Contracts C1 and C2 plus the component count, run with `node tests/cards.test.mjs`.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards, DECKS } from '../js/data/cards.js';
import { GLYPHS, hasGlyph, setArtManifest, artSrc } from '../js/cards/glyphs.js';
import { cardFace, cardBack, lifeMini } from '../js/cards/face.js';
import { ladderForAid } from '../js/game/rules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const manifest = JSON.parse(readFileSync(join(root, 'data/art-manifest.json'), 'utf8'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

test('92 physical cards, matching the component table in RULES.md section 10', () => {
  // 90, then Bubble, then Second Wind: both added 2026-08-27 after the first playtest.
  assert.equal(data.physical.length, 92);
  const per = Object.fromEntries(DECKS.map((d) => [d, (data[d] || []).reduce((a, c) => a + (c.copies || 1), 0)]));
  assert.deepEqual(per, { attack: 4, skill: 25, class: 4, advantage: 12, boss: 6, biome: 7, life: 31, mode: 1, aid: 2 });
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
  const aid = { ladder: ladderForAid(data) };
  const offenders = [];
  for (const c of data.physical) {
    const svg = cardFace(c, { size: 'sheet', aid });
    assert.ok(svg.startsWith('<svg'), `${c.id} did not render`);
    assert.ok(svg.includes('viewBox="0 0 630 880"'), `${c.id} wrong grid`);
    if (c.deck === 'aid') continue; // the two player aids are reference cards and carry die labels
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    // Boss cards state their size as a code (S, M, L, XL, UM): the rulebook
    // asks for it and it is a label, not prose. Nothing else may carry letters.
    const allowed = c.deck === 'boss' ? /^([0-9×+]+|S|M|L|XL|UM)$/ : /^[0-9×+]+$/;
    for (const txt of texts) if (!allowed.test(txt)) offenders.push(`${c.id}: "${txt}"`);
  }
  assert.deepEqual(offenders, []);
});

test('C1: the four corners carry what the layout doc says they carry (spot checks)', () => {
  setArtManifest({ slots: [] });   // grammar test: draw glyphs, not the art files
  const focus = cardFace(data.byId.focus, { size: 'sheet' });
  assert.equal((focus.match(/class="pip"/g) || []).length, 2, 'Focus: one bet pip + one Sure pip');
  assert.ok(/>75<\/text>/.test(focus), 'Focus: damage 75 bottom-right');
  const allIn = cardFace(data.byId['all-in'], { size: 'sheet' });
  assert.equal((allIn.match(/pip--ghost/g) || []).length, 4, 'All In: ghost pips mean any number');
  assert.equal((allIn.match(/<rect class="frame"/g) || []).length, 1, 'All In: doubled frame = 2 actions');
  assert.ok(/>×4<\/text>/.test(allIn), 'All In: ×4 (doubled 2026-08-27 after the first playtest)');
  const ice = cardFace(data.byId['ice-spear'], { size: 'sheet' });
  assert.ok(ice.includes('#2563eb'), 'Ice Spear: water colour');
  assert.ok(/translate\(118 /.test(ice), 'Ice Spear: class lock glyph beside the tier');
  const bubble = cardFace(data.byId.bubble, { size: 'sheet' });
  assert.ok(/fill="none" stroke="#111"[^>]*>25<\/text>/.test(bubble), 'Bubble: 25 hollow, absorbed not dealt');
  assert.equal((bubble.match(/class="pip"/g) || []).length, 0, 'Bubble: no bet, no check');
  const strike = cardFace(data.byId.strike, { size: 'sheet' });
  assert.equal((strike.match(/class="pip"/g) || []).length, 0, 'Strike: no pips at all, the simplest card');
  const lifeFire = cardFace(data.byId['life-fire'], { size: 'sheet' });
  assert.ok(lifeFire.includes('fill="#dc2626"') && />25<\/text>/.test(lifeFire), 'Fire life: red face + 25');
  const bossLife = cardFace(data.byId['life-boss'], { size: 'sheet' });
  assert.ok(bossLife.includes('fill="#111111"') && !/<text/.test(bossLife), 'Boss life: black, crown, no numeral');
  const boss5 = cardFace(data.byId['boss-um'], { size: 'sheet' });
  assert.ok(/>10×200<\/text>/.test(boss5) && />100<\/text>/.test(boss5) && />5<\/text>/.test(boss5), 'Level 5 boss: 10x200, dmg 100, rage 5');
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

test('attributed art keeps the card\'s colour: a tinted <image>, not black on black', () => {
  // The boss life card is #111 with a GOLD crown. An <image> ignores stroke, so
  // without a tint the card prints blank the day that slot gets real art.
  setArtManifest({ slots: [{ id: 'crown', source: 'http://x', creator: 'A', licence: 'CC BY' }] });
  const withArt = cardFace(data.byId['life-boss'], { size: 'sheet' });
  assert.ok(withArt.includes('<image'), 'art should be used once attributed');
  assert.ok(/<filter id="tint-\w+"/.test(withArt), 'the image must be tinted');
  assert.ok(withArt.includes('flood-color="#eab308"'), 'tinted to the card\'s gold');
  assert.ok(/filter="url\(#tint-\w+\)"/.test(withArt), 'the image must reference the filter');
  // A glyph drawn in the default ink needs no filter at all.
  setArtManifest({ slots: [{ id: 'strike', source: 'http://x', creator: 'A', licence: 'CC BY' }] });
  const plain = cardFace(data.byId.strike, { size: 'sheet' });
  assert.ok(plain.includes('<image') && !plain.includes('<filter'), 'black-ink art needs no tint');
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
