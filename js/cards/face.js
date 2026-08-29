// ── Card face renderer (contract C1) ─────────────────────────
// One function, one SVG string, used by the card browser, the print sheet
// and the play runner. The grid is 630 x 880: ten units per millimetre of a
// 63 x 88 mm poker card, so print.css can size the SVG in millimetres and
// the paper gets exactly this.
//
// docs/CARD-LAYOUT.md is the spec. Four corners, pips and numerals only:
//   top-left     bet (pips)          top-right    check (pips)
//   bottom-left  tier (numeral)      bottom-right damage (numeral)
// Oval frame holds the glyph; a DOUBLED outer frame means 2 actions; a class
// glyph beside the tier means class-locked; the element sigil sits in the
// top-left quadrant under the bet pips. Life cards: coloured face, big 25,
// sigil. No body text on any card, and the name never appears: the player
// says it out loud.

import { glyphPath, artSrc, artBody, GLYPH_SIZE } from './glyphs.js';

export const W = 630, H = 880;

export const FACE = {           // the six face colours, matched to css/style.css tokens
  fire: '#dc2626', water: '#2563eb', earth: '#16a34a', wind: '#64748b',
  extra: '#ffffff', boss: '#111111', gold: '#eab308', violet: '#7c3aed', brown: '#a16207', red: '#b91c1c',
};
export const PIPS = { sure: 1, even: 2, hard: 3, wild: 4 };
const ELEMENT_SIGIL = { fire: 'fire', water: 'water', earth: 'earth', wind: 'wind' };

/**
 * ── Colour, and where it is allowed to go ────────────────────
 *
 * The first pass put the card's only colour INSIDE the picture, by tinting the
 * glyph to the element. That is backwards twice over: a mid-tone icon on white
 * paper has less contrast than a black one (Gale's slate on white was nearly
 * gone), and it spends the element signal on the one element of the card that
 * should be carrying its own meaning. So colour moved outwards:
 *
 *   FIELD   a washed oval, the element at about a tenth strength. Large, quiet,
 *           and cheap: a wash is the least ink per square millimetre of colour
 *           on the sheet, which matters when this is printed at home.
 *   EDGE    the card's own frame, in the element. What you see of a card in a
 *           fanned hand is its edge, and nothing else on the face is visible.
 *   INK     the picture, in a DARKENED element (fire ink is red-800, not
 *           red-600). Darker than the old tint, so it gains contrast against
 *           the wash while still reading as its element.
 *
 * Net effect: much more colour, and the picture is more legible than it was,
 * not less. That is the whole trick, and it is why "add colour" did not have
 * to mean "make it busy".
 */
// The ink is the 900 of each ramp, not the 700, because the picture and its
// field are now the same hue and value is the only thing separating them. At
// red-800 on a pink wash the eye landed on "pink card" before it landed on the
// flame, which loses the one thing the picture had to keep.
export const INK = { fire: '#7f1d1d', water: '#1e3a8a', earth: '#14532d', wind: '#1e293b' };
export const WASH = { fire: '#fcdcdc', water: '#d8e5fd', earth: '#d3f2dc', wind: '#dae1ea' };

/**
 * A card with no element takes the hero's element (engine.js). So the neutral
 * cards are not "colourless", they are "whichever one you are", and the ring
 * says so by being all four at once, in the order of the element cycle. Uno
 * teaches every child this exact grammar with its black wild card.
 */
const NEUTRAL = { wash: '#f1e4c8', ink: '#1c1917', edge: '#7c6f57' };
const CYCLE = ['water', 'fire', 'wind', 'earth'];   // cards.json element_cycle, in order

/**
 * Risk, as a traffic light. A child reads green-to-red as safe-to-dangerous
 * years before they can read "25%", and the top-right corner is one of the two
 * things they look at every single turn.
 *
 * The count still carries the whole message on its own: one pip is Sure, four
 * is Wild, exactly as before. Colour is a second copy of that, never the only
 * copy, which is the rule CARD-LAYOUT.md sets for the colour-blind player and
 * the reason a green-to-red ramp is safe to use here at all.
 */
export const RISK = { sure: '#16a34a', even: '#eab308', hard: '#f97316', wild: '#dc2626' };

/**
 * The same traffic light, in HTML, for everything that talks ABOUT a check
 * without being a card: the tutorial's teaching text, the runner's check line,
 * the plan lane's markers. Both views used to draw their own black dots, so the
 * page taught one vocabulary and the card printed another. One source now.
 */
export function riskDots(check) {
  const n = PIPS[check] || 0;
  if (!n) return '';
  return `<span class="pips pips--risk" style="--risk:${RISK[check] || '#111'}" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * Tint an <image> to `colour` by flooding it through the art's own alpha.
 * Downloaded icons are black on transparent, and an <image> ignores `stroke`,
 * so without this the gold crown on the black boss life card prints black on
 * black the moment that slot gets attributed art: invisible in review, blank
 * on paper. The id is keyed by colour, so repeated definitions across the 90
 * cards of a print sheet are identical and resolve to the same filter.
 */
const tintId = (colour) => `tint-${String(colour).replace(/[^\w]/g, '')}`;
function tintFilter(colour) {
  return `<filter id="${tintId(colour)}" x="0" y="0" width="100%" height="100%">`
    + `<feFlood flood-color="${esc(colour)}" result="c"/>`
    + `<feComposite in="c" in2="SourceAlpha" operator="in"/></filter>`;
}

/**
 * A glyph placed in a box. Three sources, in order of preference:
 *   1. inlined art (glyphs.js loadArt), painted with an ordinary fill
 *   2. the same art as an <image>, tinted through a filter, if loadArt has not
 *      run or that file failed: correct on screen, black on paper
 *   3. the in-house stroked glyph
 *
 * `stroke` names the colour for historical reasons and because the in-house
 * glyphs are stroked outlines; the downloaded art is solid, so for that path
 * the same colour becomes the fill.
 */
function glyphAt(id, x, y, size, { stroke = '#111', width } = {}) {
  const art = artBody(id);
  if (art) {
    // Fit the source viewBox into the box and centre it: xMidYMid meet, by hand.
    const k = size / Math.max(art.w, art.h);
    const dx = x + (size - art.w * k) / 2 - art.minX * k;
    const dy = y + (size - art.h * k) / 2 - art.minY * k;
    return `<g class="glyph-art" transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${k.toFixed(5)})" fill="${esc(stroke)}">${art.inner}</g>`;
  }
  const src = artSrc(id);
  if (src) {
    const tint = stroke && stroke !== '#111'
      ? `${tintFilter(stroke)}<image class="glyph-art" filter="url(#${tintId(stroke)})"`
      : '<image class="glyph-art"';
    return `${tint} href="${esc(src)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const d = glyphPath(id);
  if (!d) return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.1}" fill="none" stroke="${stroke}" stroke-width="6" stroke-dasharray="14 10"/>`;
  const k = size / GLYPH_SIZE;
  const sw = width ?? 2.4;
  return `<g transform="translate(${x} ${y}) scale(${k})"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

function sigilBadge(element, cx, cy, r = 42) {
  const colour = FACE[element] || '#111';
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colour}"/>`
    + glyphAt(ELEMENT_SIGIL[element], cx - r * 0.62, cy - r * 0.62, r * 1.24, { stroke: '#fff', width: 2.8 });
}

/**
 * The bet corner counts CARDS, the check corner counts STEPS ON A LADDER. Drawn
 * as identical dots they were two piles of the same thing in two corners, and a
 * child had to remember which corner meant what. So the two now differ in every
 * channel at once: shape, colour and corner.
 *
 * Bet pips are little rounded cards. "Three of these" is three cards out of your
 * life, and the pip is a picture of the thing you hand over.
 */
function betPips(n, x, y, { w = 34, h = 46, gap = 44 } = {}) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const cx = x + i * gap;
    // Filled, with a paper-coloured inner line: a solid block at this size is a
    // smudge, and the inner line is what makes it read as a card rather than a
    // domino.
    out += `<rect class="pip pip--bet" x="${cx}" y="${y - h / 2}" width="${w}" height="${h}" rx="7" fill="#292524"/>`
      + `<rect x="${cx + 7}" y="${y - h / 2 + 9}" width="${w - 14}" height="${h - 18}" rx="3" fill="none" stroke="${PAPER}" stroke-width="3.5" opacity="0.75"/>`;
  }
  return out;
}

/**
 * "Bet as many as you like", which only All In does. Drawn as a fanned stack
 * rather than four empty boxes.
 *
 * Four empty boxes said the wrong thing twice: it looked like a count of four,
 * and it made hollow-means-unlimited collide with hollow-means-absorbed, which
 * is what the hollow damage numeral on Bubble means. Both cards are tier 0, so
 * a beginner meets the two contradictory hollows in their first game. A fan of
 * cards is not a count and not a hollow anything: it is a handful.
 */
function betFan(x, y, { w = 34, h = 46 } = {}) {
  let out = '';
  const lean = [-14, -7, 0];
  lean.forEach((deg, i) => {
    const cx = x + i * 17;
    out += `<g class="pip pip--bet pip--ghost" transform="rotate(${deg} ${cx + w / 2} ${y + h / 2})">`
      + `<rect x="${cx}" y="${y - h / 2}" width="${w}" height="${h}" rx="7" fill="${PAPER}" stroke="#292524" stroke-width="5"/></g>`;
  });
  return out;
}

/**
 * Check pips: a tight row, right-aligned from `x`, on the risk ramp.
 *
 * These were briefly laid out as die faces, on the reasoning that four items in
 * a row sits at the edge of what a six year old can take in without counting,
 * while a canonical arrangement is read as a shape. Both halves of that are
 * true and it still came out wrong on the card: no card in the working deck has
 * a check above Even, so the arrangement only ever had one or two pips to work
 * with, and two dots on a diagonal with no die drawn around them reads as two
 * dots someone dropped, not as a die. Drawing the die would have fixed the
 * shape and broken the meaning, since a die showing two would say "roll a two"
 * and the pips are rungs on a ladder, not a target. So: a row, kept tight
 * enough that one and two read as a single mark.
 */
function riskPips(check, x, y, { r = 16, gap = 38 } = {}) {
  const n = PIPS[check] || 0;
  const fill = RISK[check] || '#111';
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<circle class="pip pip--risk" cx="${x - r - i * gap}" cy="${y}" r="${r}" fill="${fill}" stroke="#1c1917" stroke-width="3"/>`;
  }
  return out;
}

/**
 * The "any element" badge, in the slot where an elemental card puts its sigil:
 * a disc quartered in the four element colours, in the cycle's order.
 *
 * This replaced a first attempt that painted the whole picture ring in four
 * arcs. That was the same idea at ten times the size, and at ten times the size
 * it stopped reading as a meaning and started reading as a mistake: a ring that
 * changes colour four times looks like a printing fault, and it fought the
 * picture it was supposed to frame. Small, in the slot the eye already checks
 * for the element, it says the one thing it needs to say.
 */
function anyElementBadge(cx, cy, r = 42) {
  let out = '';
  for (let i = 0; i < 4; i++) {
    const a = (-Math.PI * 3) / 4 + (i * Math.PI) / 2;
    const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a);
    const x2 = cx + r * Math.cos(a + Math.PI / 2), y2 = cy + r * Math.sin(a + Math.PI / 2);
    out += `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${FACE[CYCLE[i]]}"/>`;
  }
  return out + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PAPER}" stroke-width="5"/>`;
}

/**
 * The picture's field. Filled, not an outline: this is where nearly all of the
 * card's colour lives, and an outlined oval carried none of it.
 */
function oval(edge, doubled, wash = 'none') {
  let out = `<ellipse class="frame" cx="315" cy="440" rx="218" ry="256" fill="${wash}" stroke="${edge}" stroke-width="11"/>`;
  if (doubled) out += `<ellipse class="frame" cx="315" cy="440" rx="238" ry="276" fill="none" stroke="${edge}" stroke-width="6"/>`;
  return out;
}


/**
 * Damage prevented, not dealt: the same numeral drawn hollow. Bubble is the only
 * card that stops damage rather than causing it, and printing a solid "25" in the
 * damage corner would read as an attack that deals 25. Outlined is the one grammar
 * addition CARD-LAYOUT.md gained for it: solid means dealt, hollow means absorbed.
 */
function hollowNumeral(text, x, y, size, anchor = 'end', stroke = '#111') {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="900" text-anchor="${anchor}" `
    + `fill="none" stroke="${stroke}" stroke-width="5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${esc(text)}</text>`;
}

function numeral(text, x, y, size, anchor = 'start', fill = '#111', weight = 900) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${esc(text)}</text>`;
}

// Warm white, not pure. Pure #fff is the colour of the paper it prints on, so a
// white card had no edge until the frame line; on screen it glared next to the
// site's own parchment. This is the same off-white the site uses.
const PAPER = '#fffdf7';

function frame(faceFill, frameColour, doubled) {
  let out = `<rect class="face" x="15" y="15" width="${W - 30}" height="${H - 30}" rx="36" fill="${faceFill}" stroke="${frameColour}" stroke-width="12"/>`;
  if (doubled) out += `<rect class="frame" x="42" y="42" width="${W - 84}" height="${H - 84}" rx="26" fill="none" stroke="${frameColour}" stroke-width="6"/>`;
  return out;
}

// ── Per-deck faces ───────────────────────────────────────────

function attackOrSkill(c) {
  const el = c.element;
  const edge = el ? FACE[el] : NEUTRAL.edge;
  const ink = el ? INK[el] : NEUTRAL.ink;
  const wash = el ? WASH[el] : NEUTRAL.wash;
  const doubled = (c.actions || 1) >= 2;
  let out = frame(PAPER, edge, doubled);
  // top-left: bet, in cards. top-right: check, on the traffic light.
  if (c.bet === 'any') out += betFan(58, 96);
  else if (c.bet > 0) out += betPips(c.bet, 54, 96);
  if (c.check) out += riskPips(c.check, W - 54, 96);
  // top-centre: the element, named as well as coloured. CARD-LAYOUT.md requires
  // both, so that a colour-blind player never has only the wash to go on. A card
  // with no element of its own takes the hero's (engine.js), which is what the
  // four-quarter badge says: not "colourless", but "whichever one you are".
  out += el ? sigilBadge(el, 315, 96, 42) : anyElementBadge(315, 96, 42);
  // centre: washed field, then the picture at full size in the darkened element
  out += `<ellipse cx="315" cy="440" rx="218" ry="256" fill="${wash}"/>`;
  out += oval(edge, doubled, 'none');
  out += glyphAt(c.icon, 315 - 155, 440 - 155, 310, { stroke: ink, width: 2.5 });
  // Tier, moved off the bottom-left corner and shrunk.
  //
  // A blind read of the deck got it wrong on every single card, and always the
  // same way: a small number in the corner opposite a big number reads as the
  // price of the big number, because in every other card game that is what it
  // is. Tier is not a price. It is which level the card enters the game at, it
  // decides nothing during a turn, and while it sat mirroring the damage it was
  // actively teaching a beginner the wrong thing about the most important
  // number on the card. Bottom centre, small and grey, it no longer pairs with
  // anything. The corner belongs to the class lock, which IS a rule about play.
  if (c.class) out += glyphAt(c.class, 52, H - 136, 76, { stroke: FACE.violet, width: 2.6 });
  out += numeral(String(c.tier ?? 0), 300, H - 54, 36, 'middle', '#c6bdae');
  // bottom-right: damage dealt, or (hollow) damage absorbed
  if (c.shield) {
    out += hollowNumeral(String(c.shield), W - 58, H - 58, 92, 'end', ink);
  } else if (c.damage) {
    const dmg = typeof c.damage === 'number' ? String(c.damage) : c.damage === '4x bet' ? '×4' : String(c.damage ?? '');
    out += numeral(dmg, W - 58, H - 58, dmg.length > 3 ? 72 : 92, 'end', ink);
  }
  // A card that deals nothing prints nothing in the damage corner. Run is the
  // first of those, and a printed "0" would read as a damage value rather than
  // as its absence, which is the opposite of what the grammar promises: every
  // other mark on this card face means something by being there, so the corner
  // has to mean something by being empty.
  return out;
}

function classCard(c) {
  let out = frame(PAPER, FACE.violet, false);
  out += oval(FACE.violet, false, '#efe6fd');
  out += glyphAt(c.icon, 315 - 155, 440 - 155, 310, { stroke: '#5b21b6', width: 2.5 });
  return out;
}

function advantageCard(c) {
  let out = frame(PAPER, FACE.gold, false);
  out += oval(FACE.gold, false, '#fdf3d3');
  out += glyphAt(c.icon, 315 - 155, 440 - 155, 310, { stroke: '#78350f', width: 2.5 });
  // a small gold chip top-left marks the deck without a word
  out += `<circle cx="92" cy="92" r="30" fill="${FACE.gold}" stroke="#78350f" stroke-width="6"/>`;
  return out;
}

const BIOME_RULE_MARK = { forest: ['eye', '0'], village: ['life', '+1'], castle: ['crown', '×2'] };
const BIOME_NEUTRAL = { edge: FACE.brown, ink: '#713f12', wash: '#f6ecd6' };
function biomeCard(c) {
  const el = c.element;
  const edge = el ? FACE[el] : BIOME_NEUTRAL.edge;
  const ink = el ? INK[el] : BIOME_NEUTRAL.ink;
  const wash = el ? WASH[el] : BIOME_NEUTRAL.wash;
  let out = frame(PAPER, edge, false);
  if (el) out += sigilBadge(el, 315, 96, 42);
  out += oval(edge, false, wash);
  out += glyphAt(c.icon, 315 - 155, 440 - 155, 310, { stroke: ink, width: 2.5 });
  const mark = BIOME_RULE_MARK[c.id];
  if (mark) {
    out += glyphAt(mark[0], W - 205, H - 132, 80, { stroke: ink, width: 2.5 });
    out += numeral(mark[1], W - 58, H - 58, 80, 'end', ink);
  }
  return out;
}

/**
 * The boss was the palest card on the table: white paper, black outline, and it
 * read as the least dangerous thing in the box. It is now the only dark face in
 * the deck, which is both correct and useful, since a boss is the one card that
 * has to be findable across a table at a glance.
 */
function bossCard(c) {
  const NIGHT = '#1c1917', PLATE = '#3b3733';
  let out = `<rect class="face" x="15" y="15" width="${W - 30}" height="${H - 30}" rx="36" fill="${NIGHT}" stroke="${FACE.gold}" stroke-width="12"/>`;
  // top-left: life cards x value (the two numbers the rulebook says the card states)
  out += numeral(`${c.life_cards}×${c.per_card}`, 52, 116, 78, 'start', '#fde68a');
  out += oval(FACE.gold, false, PLATE);
  out += glyphAt(c.icon, 315 - 155, 420 - 155, 310, { stroke: '#fef3c7', width: 2.5 });
  out += numeral(c.size, 315, 648, 110, 'middle', '#fef3c7');
  // bottom-left: rage round in a red chip (a minion has none)
  if (c.rage) {
    out += `<circle cx="112" cy="${H - 92}" r="56" fill="${FACE.fire}" stroke="#fca5a5" stroke-width="5"/>`;
    out += numeral(String(c.rage), 112, H - 68, 72, 'middle', '#fff');
  }
  // bottom-right: damage
  out += numeral(String(c.damage), W - 58, H - 58, 92, 'end', '#fff');
  return out;
}

function lifeCard(c) {
  const faceFill = c.element ? FACE[c.element] : (c.id === 'life-boss' ? FACE.boss : FACE.extra);
  const dark = c.element || c.id === 'life-boss';
  const ink = dark ? '#fff' : '#111';
  let out = frame(faceFill, '#111', false);
  if (c.element) {
    out += `<circle cx="102" cy="102" r="46" fill="#fff"/>`;
    out += glyphAt(ELEMENT_SIGIL[c.element], 102 - 30, 102 - 30, 60, { stroke: FACE[c.element], width: 2.8 });
  }
  if (c.id === 'life-boss') {
    out += glyphAt('crown', 315 - 180, 430 - 180, 360, { stroke: FACE.gold, width: 2.2 });
  } else {
    out += numeral('25', 315, 540, 300, 'middle', ink);
  }
  return out;
}

// One glyph per boss reaction, keyed by the name in cards.json. The map lives
// here rather than in the data because it is a drawing decision: the rulebook
// names the reaction, the card has to show it without words.
const REACTION_GLYPH = { Brace: 'shield', Strike: 'strike', Summon: 'boss-s', Roar: 'bolt', Ruin: 'skull' };

// Player aids are reference cards, the one place a label is allowed. The dice
// ladder is generated from the same targets the engine uses (game/rules.js
// ports tools/dice_bridge.py); the view passes them in via opts.aid.
function aidCard(c, opts) {
  let out = frame(PAPER, '#57534e', false);
  if (c.id === 'aid-checks' && opts.aid?.ladder) {
    // One row per die, one column per step (pips as the header), so "16+"
    // has a 110-unit column instead of the 52 it got with dice as columns.
    const { dice, rows } = opts.aid.ladder; // dice: ['d20',...]; rows: [{step, pips, odds, targets}]
    const x0 = 150, colW = (W - 40 - x0) / rows.length, y0 = 150, rowH = (H - 60 - y0) / dice.length;
    // The aid is where a player learns the ladder, so it has to teach the same
    // colours the cards are printed in, not a monochrome copy of them.
    // r=9/gap=24 keeps the four-pip Wild group inside its 110-unit column; at
    // the card's own pip size it spilled into the Hard column beside it.
    rows.forEach((r, j) => {
      const cx = x0 + colW * j + colW / 2;
      out += riskPips(r.step, cx + (r.pips * 24 - 6) / 2, 78, { r: 9, gap: 24 });
      out += numeral(`${r.odds}%`, cx, 128, 30, 'middle', '#625c52', 700);
    });
    dice.forEach((d, i) => {
      const y = y0 + i * rowH;
      out += numeral(d, 40, y + rowH * 0.68, 40, 'start', '#111', 800);
      rows.forEach((r, j) => { out += numeral(`${r.targets[d]}+`, x0 + colW * j + colW / 2, y + rowH * 0.68, 46, 'middle'); });
      if (i < dice.length - 1) out += `<line x1="30" y1="${y + rowH}" x2="${W - 30}" y2="${y + rowH}" stroke="#ddd6c3" stroke-width="3"/>`;
    });
    out += `<line x1="${x0 - 10}" y1="${y0}" x2="${x0 - 10}" y2="${H - 60}" stroke="#ddd6c3" stroke-width="3"/>`;
  } else if (c.id === 'aid-turn') {
    const rows = [['untap', null], ['strike', '3'], ['boss-s', '25'], ['dice', null]];
    rows.forEach(([g, n], i) => {
      const y = 110 + i * 190;
      out += `<circle cx="100" cy="${y + 70}" r="44" fill="${FACE.gold}" stroke="#111" stroke-width="6"/>`;
      out += numeral(String(i + 1), 100, y + 92, 60, 'middle');
      out += glyphAt(g, 200, y + 10, 120, { stroke: '#111' });
      if (n) out += numeral(n, 360, y + 98, 80);
      if (g === 'dice') out += glyphAt('crown', 360, y + 20, 100, { stroke: '#111' });
    });
  } else if (c.id === 'aid-boss' && opts.aid?.reactions) {
    // The boss's whole round, as the six faces of the die it rolls. The rows come
    // from cards.json through opts.aid.reactions, never from a copy written here,
    // so the printed aid and the engine cannot disagree about what a 4 does. A
    // boss that overrides a row says so on its own card; this one is the default.
    const rows = opts.aid.reactions;
    const rowH = (H - 200) / rows.length;
    rows.forEach((r, i) => {
      const y = 130 + i * rowH;
      const label = Array.isArray(r.roll) ? `${r.roll[0]}-${r.roll[r.roll.length - 1]}` : String(r.roll);
      out += `<rect x="46" y="${y}" width="112" height="112" rx="20" fill="none" stroke="#111" stroke-width="6"/>`;
      out += numeral(label, 102, y + 82, label.length > 1 ? 52 : 72, 'middle');
      out += glyphAt(REACTION_GLYPH[r.name] || 'dice', 190, y + 6, 100, { stroke: '#111' });
      // opts.reactionNames is handed in by the view so this module stays free of
      // the string table: face.js is shared with the Python-free print path and
      // the node tests, neither of which sets a language.
      out += numeral((opts.aid?.reactionNames?.[r.id]) || r.name, 314, y + 82, 58, 'start');
      if (i < rows.length - 1) out += `<line x1="40" y1="${y + rowH - 16}" x2="${W - 40}" y2="${y + rowH - 16}" stroke="#ddd6c3" stroke-width="3"/>`;
    });
  } else if (c.id === 'aid-track') {
    // Four bands of 25 and a home for the die that counts hundreds. The bands are
    // 128 units (12.8mm) tall and full width because a real 1x1 brick stands on
    // one of them: any tighter and the brick covers the two numbers either side.
    // The dashed square is that brick's footprint, so the card teaches its own use
    // with no sentence on it.
    [25, 50, 75, 100].forEach((n, i) => {
      const y = 116 + i * 142;
      out += `<rect x="42" y="${y}" width="${W - 84}" height="128" rx="18" fill="${i % 2 ? '#f5f0e3' : PAPER}" stroke="#57534e" stroke-width="5"/>`;
      out += numeral(String(n), 92, y + 94, 82, 'start');
      out += `<rect x="${W - 186}" y="${y + 20}" width="88" height="88" rx="12" fill="none" stroke="#a8a29e" stroke-width="5" stroke-dasharray="14 10"/>`;
    });
    // The wrap, in gold because it is the one row that is not part of the track:
    // past 100 the brick starts again and this die remembers the hundreds.
    const y = 116 + 4 * 142 + 22;
    out += `<rect x="42" y="${y}" width="${W - 84}" height="128" rx="18" fill="#fdf3d3" stroke="${FACE.gold}" stroke-width="6"/>`;
    out += numeral('×100', 92, y + 92, 74, 'start', '#78350f');
    out += `<rect x="${W - 186}" y="${y + 20}" width="88" height="88" rx="12" fill="none" stroke="#a16207" stroke-width="5" stroke-dasharray="14 10"/>`;
    out += glyphAt('dice', W - 172, y + 34, 60, { stroke: '#a16207' });
  } else {
    out += glyphAt('dice', 315 - 150, 430 - 150, 300, { stroke: '#111' });
  }
  return out;
}

/**
 * Render one card.
 * @param {object} card   an entry from data/cards.json (with .deck set by data/cards.js)
 * @param {{size?: 'sheet'|'browse'|'hand'|'mini', cls?: string, aid?: object, title?: string}} opts
 * @returns {string} inline SVG
 */
/**
 * The gentle-mode card. It has to say four things with no words: what it is (the
 * hand), that the first comeback is free (an empty circle), and that every one
 * after costs a harder roll (the pip ladder, the same vocabulary every check in
 * this game uses). A card carrying only its picture would teach none of that.
 */
function modeCard(c) {
  let out = frame(PAPER, FACE.gold, true);
  out += `<ellipse cx="315" cy="370" rx="212" ry="212" fill="#fdf3d3"/>`;
  out += `<ellipse cx="315" cy="370" rx="212" ry="212" fill="none" stroke="${FACE.gold}" stroke-width="11"/>`;
  out += glyphAt(c.icon, 315 - 155, 370 - 155, 310, { stroke: '#78350f', width: 2.5 });
  // The comeback ladder is Second Wind's alone: Sidekick and Grudge are mode
  // cards too now, and drawing another card's ladder on them would print a
  // rule they do not have. They carry only their picture, which is the deck's
  // grammar working as designed.
  if (c.id !== 'second-wind') return out;
  // The comeback ladder, in the same traffic light every check on every other
  // card uses: free, then Sure, Even, Hard, Wild. Learn it once, read it here.
  // Five rungs laid left to right, each sized to its own pip count so the four
  // groups never run together: at an even spacing the Wild group's four pips
  // collided with Hard's three and the ladder read as one long caterpillar.
  const y = 706, r = 12, pitch = 30, groupGap = 32;
  const widths = [2 * r, ...[1, 2, 3, 4].map((n) => (n - 1) * pitch + 2 * r)];
  const total = widths.reduce((a, b) => a + b, 0) + groupGap * 4;
  let x = 315 - total / 2;
  out += `<circle cx="${x + r}" cy="${y}" r="${r + 11}" fill="none" stroke="#78350f" stroke-width="7"/>`;
  x += widths[0] + groupGap;
  ['sure', 'even', 'hard', 'wild'].forEach((step, i) => {
    out += riskPips(step, x + widths[i + 1], y, { r, gap: pitch });
    x += widths[i + 1] + groupGap;
  });
  out += `<line x1="${315 - total / 2 - 24}" y1="${y + 54}" x2="${315 + total / 2 + 24}" y2="${y + 54}" stroke="${FACE.gold}" stroke-width="4" opacity="0.6"/>`;
  return out;
}

export function cardFace(card, opts = {}) {
  const size = opts.size || 'browse';
  let body;
  switch (card.deck) {
    case 'attack': case 'skill': body = attackOrSkill(card); break;
    case 'class': body = classCard(card); break;
    case 'advantage': body = advantageCard(card); break;
    case 'biome': body = biomeCard(card); break;
    case 'boss': body = bossCard(card); break;
    case 'life': body = lifeCard(card); break;
    case 'mode': body = modeCard(card); break;
    case 'aid': body = aidCard(card, opts); break;
    default: body = frame('#fff', '#111', false);
  }
  const label = opts.title ? `<title>${esc(opts.title)}</title>` : '';
  return `<svg class="sk-card sk-card--${size} ${opts.cls || ''}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(card.name || card.id)}" data-card="${esc(card.id)}">${label}${body}</svg>`;
}

/**
 * The picture on an unbroken back, per deck. A pile face down should still say
 * which pile it is: a book for the skills you are learning, a coin for the
 * Advantage and the comeback you are spending, bricks for the place you are
 * fighting in, and a learning mark for the two reference cards.
 */
const BACK_EMBLEM = {
  skill: 'back-skill',
  advantage: 'back-coin',
  mode: 'back-coin',
  biome: 'back-biome',
  aid: 'back-aid',
};

/** A card back: the deck's face colour, a gold ring, nothing else. */
const BACK_DARK = { fire: '#7f1d1d', water: '#1e3a8a', earth: '#14532d', wind: '#334155', extra: '#713f12', boss: '#000000', skill: '#713f12', advantage: '#78350f', biome: '#3f3a1f', aid: '#3f3f46' };
/** The field colour per deck back. Without this every non-life back is gold. */
const BACK_FIELD = { skill: FACE.gold, advantage: '#d97706', biome: '#8a8f4a', aid: '#71717a' };

/** A field of studs: the construction-toy language the whole game is played in. */
function studField(ink) {
  let out = '';
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      out += `<circle cx="${110 + c * 137}" cy="${120 + r * 132}" r="15" fill="${ink}" opacity="0.16"/>`;
    }
  }
  return out;
}

/** A jagged line across the card, deterministic so every printed back matches. */
function breakLine(y, amp = 26, step = 42) {
  const pts = [];
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let x = 15; x < W - 15; x += step) pts.push([x, y + rnd() * amp]);
  pts.push([W - 15, y + rnd() * amp]);
  return pts;
}
const asPath = (pts, dy = 0) => 'M' + pts.map(([x, y]) => `${x.toFixed(0)} ${(y + dy).toFixed(0)}`).join(' L');

/**
 * The pool back's emblem: a 2x2 brick seen from above, which is the object the
 * whole game is played with. The comment on `cardBack` has always promised an
 * emblem here; until now the branch drew two bare concentric rings, which is why
 * the Skills pile read as an unfinished card rather than a face-down one.
 *
 * Paths and circles only, no text: `tests/cards.test.mjs` forbids text on a card,
 * and a back that needed a word would be a back that failed to say it.
 */
function brickEmblem(ink, dark) {
  const cx = 315, cy = 440, half = 84, stud = 27, off = 42;
  let out = `<rect x="${cx - half}" y="${cy - half}" width="${half * 2}" height="${half * 2}" rx="22" fill="${ink}" opacity="0.92"/>`;
  out += `<rect x="${cx - half}" y="${cy - half}" width="${half * 2}" height="${half * 2}" rx="22" fill="none" stroke="${dark}" stroke-width="8"/>`;
  for (const dx of [-off, off]) {
    for (const dy of [-off, off]) {
      out += `<circle cx="${cx + dx}" cy="${cy + dy}" r="${stud}" fill="none" stroke="${dark}" stroke-width="9"/>`;
    }
  }
  return out;
}

/**
 * The back of a card. Two different backs, because they mean different things:
 *
 * A LIFE card is Broken face down, so its back is what a player stares at after
 * losing something. It is the element's own colour, snapped across the middle,
 * so the card itself reads as broken rather than carrying a picture of something
 * broken. That was the player's idea and it is better than the icon it replaced.
 *
 * A SKILL card sits face down in the draft pool, where it is not broken at all,
 * so it gets the same studded field with an emblem and NO break. Printing the
 * broken back on a draft pile would say the wrong thing entirely.
 *
 * Both are a solid field, which is deliberate but not free: 110 of these is real
 * ink on a home printer. `light` swaps to a paper field with a coloured border
 * for anyone who would rather keep their cartridge.
 */
export function cardBack(kind = 'skill', { light = false, size = 'sheet', cls = '' } = {}) {
  // The Extra life card is white-faced, and a white back on white paper is a
  // blank card: it gets the brown instead.
  const colour = kind === 'extra' ? FACE.brown : BACK_FIELD[kind] || FACE[kind] || FACE.gold;
  const dark = BACK_DARK[kind] || '#713f12';
  const field = light ? FACE.extra : colour;
  const ink = light ? colour : FACE.extra;
  const broken = kind in FACE && kind !== 'skill' && kind !== 'gold';

  let out = `<rect x="15" y="15" width="${W - 30}" height="${H - 30}" rx="36" fill="${field}" stroke="#111" stroke-width="10"/>`;
  out += studField(ink);
  if (broken) {
    const pts = breakLine(440);
    out += `<path d="${asPath(pts)}" fill="none" stroke="${light ? '#fffdf8' : FACE.extra}" stroke-width="24" stroke-linejoin="round"/>`;
    out += `<path d="${asPath(pts, -12)}" fill="none" stroke="${dark}" stroke-width="6" stroke-linejoin="round"/>`;
    out += `<path d="${asPath(pts, 12)}" fill="none" stroke="${dark}" stroke-width="6" stroke-linejoin="round"/>`;
  } else {
    // An emblem that says what the pile IS. The unbroken back used to be one
    // ring plus a generic brick for every non-life deck, so the skill pool, the
    // Advantage deck, the biomes and the player aids were four identical piles
    // face down on the same table. BACK_EMBLEM is the slot id per deck; each
    // falls back to the brick if its art has not been downloaded yet.
    out += `<circle cx="315" cy="440" r="132" fill="none" stroke="${ink}" stroke-width="14" opacity="0.85"/>`;
    const emblem = BACK_EMBLEM[kind];
    out += emblem && (artBody(emblem) || glyphPath(emblem))
      ? glyphAt(emblem, 315 - 96, 440 - 96, 192, { stroke: ink, width: 2.6 })
      : brickEmblem(ink, dark);
  }
  return `<svg class="sk-card sk-card--${size} ${cls}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="card back">${out}</svg>`;
}

/**
 * The six life cards, as the renderer needs them. Card data lives in
 * cards.json and the runner holds only a `kind` string per pool card, so this
 * is the lookup that turns one back into the other without threading the
 * loaded data through every pile.
 */
const LIFE_CARD = {
  fire: { id: 'life-fire', name: 'Fire', deck: 'life', icon: 'fire', element: 'fire', value: 25 },
  water: { id: 'life-water', name: 'Water', deck: 'life', icon: 'water', element: 'water', value: 25 },
  earth: { id: 'life-earth', name: 'Earth', deck: 'life', icon: 'earth', element: 'earth', value: 25 },
  wind: { id: 'life-wind', name: 'Wind', deck: 'life', icon: 'wind', element: 'wind', value: 25 },
  extra: { id: 'life-extra', name: 'Extra', deck: 'life', icon: 'life', element: null, value: 25 },
  boss: { id: 'life-boss', name: 'Boss', deck: 'life', icon: 'crown', element: null, value: 'per boss card' },
};

/**
 * A life card in the runner's piles.
 *
 * This used to be a SECOND life-card grammar: a rounded coloured rectangle with
 * an oversized sigil, written before the faces were designed and never updated
 * with them. The screen therefore showed a card that no printer would ever
 * produce, which is what "the main page still displays old images" meant. It
 * now renders the real face, and a Broken card renders the real BACK, which is
 * the one place the redesigned back was visible on paper and nowhere on screen.
 */
export function lifeMini(kind, stateCls = '') {
  const cls = `lc ${stateCls}`.trim();
  if (/\bis-broken\b/.test(stateCls)) return cardBack(kind, { size: 'mini', cls });
  const card = LIFE_CARD[kind];
  if (!card) return '';
  return cardFace(card, { size: 'mini', cls, title: card.name });
}
