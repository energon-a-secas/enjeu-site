// The card-to-PNG seam, as far as node can see it.
//
// toPngBlob needs a canvas and is exercised for real by tools/export_cards.py,
// which drives the same functions in a browser and writes 222 files. What IS
// testable here is everything the printer actually depends on: that the pixel
// size clears the floor the service states, that the card's proportions survive
// it, that a flattened card is opaque edge to edge, and that faces and backs
// land on filenames that pair.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { cardFace, cardBack } from '../js/cards/face.js';
import { backKind } from '../js/cards/sheet.js';
import { normaliseArt } from '../js/cards/glyphs.js';
import { PRINT_SIZES, printSize, printableSvg, fieldColour, cardFileName, CARD_MM, UNITS_PER_MM } from '../js/cards/png.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

// The number the printing service asks for, and the reason the default is not
// a plain 300 DPI: a 63 x 88mm card at 300 DPI is 744 x 1039, which is UNDER
// this on both axes, because the service's figure assumes a 63.5 x 88.9mm card.
const FLOOR = { w: 750, h: 1050 };

test('the default size clears the printing service floor on both axes', () => {
  const s = printSize('standard');
  assert.ok(s.width >= FLOOR.w, `width ${s.width} is under ${FLOOR.w}`);
  assert.ok(s.height >= FLOOR.h, `height ${s.height} is under ${FLOOR.h}`);
  // And a true 300 DPI would NOT, which is why the preset is what it is.
  const at300 = { w: Math.round(CARD_MM.w / 25.4 * 300), h: Math.round(CARD_MM.h / 25.4 * 300) };
  assert.ok(at300.w < FLOOR.w && at300.h < FLOOR.h,
    `300 DPI gives ${at300.w}x${at300.h}, which already clears the floor: the preset can be simplified`);
});

test('no preset stretches the card: every size keeps the printed proportions', () => {
  const aspect = 630 / 880;
  for (const name of Object.keys(PRINT_SIZES)) {
    const s = printSize(name);
    const bleed = s.bleedMm * UNITS_PER_MM * 2;
    const want = (CARD_MM.w * UNITS_PER_MM + bleed) / (CARD_MM.h * UNITS_PER_MM + bleed);
    assert.ok(Math.abs(s.width / s.height - want) < 0.002, `${name}: ${s.width}x${s.height} is not the card's shape`);
    if (!s.bleedMm) assert.ok(Math.abs(s.width / s.height - aspect) < 0.002, `${name} drifted from 630:880`);
  }
});

test('bleed grows the image and nothing else', () => {
  const plain = printSize('standard'), bled = printSize('bleed');
  assert.equal(bled.bleedMm, 3);
  // 3mm each side at 10 units per mm, times the same scale as the plain preset.
  const k = plain.width / (CARD_MM.w * UNITS_PER_MM);
  assert.equal(bled.width, Math.round((CARD_MM.w * UNITS_PER_MM + 60) * k));
  assert.equal(bled.height, Math.round((CARD_MM.h * UNITS_PER_MM + 60) * k));
});

test('a flattened card is opaque to the edge, in its own colour', () => {
  // What the screen draws is a rounded rect inset 15 units inside the viewBox,
  // so the corners and a 1.5mm border are TRANSPARENT. A service composites its
  // own background into those, which is how a card comes back with a white ring.
  const raw = cardFace(data.byId.strike, { size: 'sheet' });
  assert.match(raw, /<rect class="face" x="15" y="15"/, 'the card still insets its field, so flattening is still needed');

  const flat = printableSvg(raw, { bleedMm: 0 });
  assert.match(flat, /^<svg[^>]*viewBox="0 0 630 880"/, 'the trim box is unchanged');
  assert.match(flat, /<rect x="0" y="0" width="630" height="880" fill="#fffdf7"\/>/, 'no full-bleed field behind the card');
  assert.ok(flat.indexOf('<rect x="0"') < flat.indexOf('<rect class="face"'), 'the field must sit BEHIND the card');

  // A back's field is its own colour, not the paper.
  const back = printableSvg(cardBack('skill', { size: 'sheet' }), { bleedMm: 0 });
  assert.match(back, /<rect x="0" y="0" width="630" height="880" fill="#eab308"\/>/);
});

test('bleed extends the field outward without moving the artwork', () => {
  const flat = printableSvg(cardFace(data.byId.strike, { size: 'sheet' }), { bleedMm: 3 });
  assert.match(flat, /viewBox="-30 -30 690 940"/, '3mm is 30 units on each side');
  assert.match(flat, /<rect x="-30" y="-30" width="690" height="940"/);
  // The card itself is untouched: still drawn at 15,15 in the same coordinates.
  assert.match(flat, /<rect class="face" x="15" y="15" width="600" height="850"/);
});

test('the field colour is read off the card, never recomputed', () => {
  // Every distinct card, so a palette change cannot leave one deck exporting on
  // the wrong background without anything noticing.
  for (const c of data.physical.filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i)) {
    const svg = cardFace(c, { size: 'sheet' });
    const first = /<rect\b[^>]*\bfill="([^"]+)"/.exec(svg);
    assert.ok(first, `${c.id}: no filled rect to take a field colour from`);
    assert.equal(fieldColour(svg), first[1], `${c.id}: the flattened field disagrees with the card`);
    assert.match(fieldColour(svg), /^#[0-9a-f]{3,8}$/i, `${c.id}: field colour is not a plain hex`);
  }
});

test('faces and backs pair: same stem, same order, one file each', () => {
  const seen = new Set();
  data.physical.forEach((c, i) => {
    const f = cardFileName(c, i, 'face', 'es');
    const b = cardFileName(c, i, 'back', 'es');
    assert.equal(f.replace('-face-', '-back-'), b, `${c.id}: the two sides do not pair`);
    assert.match(f, /^\d{3}-[a-z0-9-]+-face-es\.png$/, f);
    assert.equal(seen.has(f), false, `${f} is not unique`);
    seen.add(f);
  });
  assert.equal(seen.size, data.physical.length, 'one face file per printed card');
  // Zero padded to three, so a directory listing is deck order rather than 1, 10, 100.
  assert.ok(cardFileName(data.physical[0], 0).startsWith('001-'));
  assert.ok(cardFileName(data.physical[9], 9).startsWith('010-'));
});

test('every back kind a card can ask for actually renders a field', () => {
  const kinds = [...new Set(data.physical.map((c) => backKind(c)))];
  assert.ok(kinds.length >= 8, `expected the full set of backs, saw ${kinds.length}`);
  for (const k of kinds) {
    const svg = cardBack(k, { size: 'sheet' });
    assert.match(fieldColour(svg), /^#[0-9a-f]{3,8}$/i, `back "${k}" has no field colour to flatten onto`);
  }
});

/**
 * The two things that broke the whole export, both of them drawing-tool residue
 * that is harmless inlined into a page and fatal to a standalone SVG. A canvas
 * refuses to export at all once any foreignObject is in the tree, so ONE card
 * carrying one took the other 110 down with it.
 */
test('inlined art carries nothing that would taint a canvas or fail XML parsing', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'data/art-manifest.json'), 'utf8'));
  const slots = manifest.slots.filter((s) => s.source && s.creator && s.licence);
  assert.ok(slots.length > 50, `expected the attributed set, saw ${slots.length}`);
  let checked = 0;
  for (const slot of slots) {
    let raw;
    try { raw = readFileSync(join(root, 'art', `${slot.id}.svg`), 'utf8'); } catch { continue; }
    const body = normaliseArt(raw);
    if (!body) continue;
    checked++;
    assert.equal(/foreignObject/i.test(body.inner), false, `${slot.id}: a foreignObject taints every canvas it is drawn on`);
    assert.equal(/<script/i.test(body.inner), false, `${slot.id}: a script tag`);
    assert.equal(/<image\b/i.test(body.inner), false, `${slot.id}: an external <image> cannot load inside an SVG-as-Image`);
    // An undeclared namespace prefix is a fatal XML error once the wrapping
    // <svg> that declared it has been stripped.
    const prefixed = body.inner.match(/\s[a-zA-Z][\w-]*:[a-zA-Z][\w-]*\s*=/g) || [];
    assert.deepEqual(prefixed, [], `${slot.id}: prefixed attribute(s) with no namespace: ${prefixed.join(' ')}`);
  }
  assert.ok(checked > 50, `only checked ${checked} art files`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
