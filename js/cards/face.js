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

import { glyphPath, artSrc, GLYPH_SIZE } from './glyphs.js';

export const W = 630, H = 880;

export const FACE = {           // the six face colours, matched to css/style.css tokens
  fire: '#dc2626', water: '#2563eb', earth: '#16a34a', wind: '#64748b',
  extra: '#ffffff', boss: '#111111', gold: '#eab308', violet: '#7c3aed', brown: '#a16207', red: '#b91c1c',
};
export const PIPS = { sure: 1, even: 2, hard: 3, wild: 4 };
const ELEMENT_SIGIL = { fire: 'fire', water: 'water', earth: 'earth', wind: 'wind' };

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

/** A glyph placed in a box: an attributed art file as <image>, else the stroked path. */
function glyphAt(id, x, y, size, { stroke = '#111', width } = {}) {
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

/** A row of pips. `ghost` pips are outlined: "as many as you like". */
function pipRow(n, x, y, { align = 'left', ghost = false, r = 17, gap = 46, fill = '#111' } = {}) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const cx = align === 'left' ? x + r + i * gap : x - r - i * gap;
    out += ghost
      ? `<circle class="pip pip--ghost" cx="${cx}" cy="${y}" r="${r}" fill="none" stroke="${fill}" stroke-width="4" opacity="0.4"/>`
      : `<circle class="pip" cx="${cx}" cy="${y}" r="${r}" fill="${fill}"/>`;
  }
  return out;
}

function sigilBadge(element, cx, cy, r = 42) {
  const colour = FACE[element] || '#111';
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colour}"/>`
    + glyphAt(ELEMENT_SIGIL[element], cx - r * 0.62, cy - r * 0.62, r * 1.24, { stroke: '#fff', width: 2.8 });
}

function oval(colour, doubled) {
  let out = `<ellipse class="frame" cx="315" cy="430" rx="215" ry="262" fill="none" stroke="${colour}" stroke-width="10"/>`;
  if (doubled) out += `<ellipse class="frame" cx="315" cy="430" rx="235" ry="282" fill="none" stroke="${colour}" stroke-width="6"/>`;
  return out;
}

/**
 * Damage prevented, not dealt: the same numeral drawn hollow. Bubble is the only
 * card that stops damage rather than causing it, and printing a solid "25" in the
 * damage corner would read as an attack that deals 25. Outlined is the one grammar
 * addition CARD-LAYOUT.md gained for it: solid means dealt, hollow means absorbed.
 */
function hollowNumeral(text, x, y, size, anchor = 'end') {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="900" text-anchor="${anchor}" `
    + `fill="none" stroke="#111" stroke-width="4" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${esc(text)}</text>`;
}

function numeral(text, x, y, size, anchor = 'start', fill = '#111', weight = 900) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${esc(text)}</text>`;
}

function frame(faceFill, frameColour, doubled) {
  let out = `<rect class="face" x="15" y="15" width="${W - 30}" height="${H - 30}" rx="36" fill="${faceFill}" stroke="${frameColour}" stroke-width="10"/>`;
  if (doubled) out += `<rect class="frame" x="40" y="40" width="${W - 80}" height="${H - 80}" rx="26" fill="none" stroke="${frameColour}" stroke-width="6"/>`;
  return out;
}

// ── Per-deck faces ───────────────────────────────────────────

function attackOrSkill(c) {
  const el = c.element;
  const colour = el ? FACE[el] : '#111';
  const doubled = (c.actions || 1) >= 2;
  let out = frame('#fff', '#111', doubled);
  // top-left: bet
  if (c.bet === 'any') out += pipRow(4, 60, 82, { ghost: true });
  else if (c.bet > 0) out += pipRow(c.bet, 60, 82);
  // top-right: check
  if (c.check) out += pipRow(PIPS[c.check], W - 60, 82, { align: 'right' });
  // element sigil under the bet pips
  if (el) out += sigilBadge(el, 104, 182, 46);
  // centre
  out += oval(colour, false);
  out += glyphAt(c.icon, 315 - 150, 430 - 150, 300, { stroke: colour });
  // bottom-left: tier, plus class lock
  out += numeral(String(c.tier ?? 0), 62, H - 58, 72);
  if (c.class) out += glyphAt(c.class, 118, H - 118, 70, { stroke: FACE.violet, width: 2.6 });
  // bottom-right: damage dealt, or (hollow) damage absorbed
  if (c.shield) {
    out += hollowNumeral(String(c.shield), W - 58, H - 58, 92);
  } else {
    const dmg = typeof c.damage === 'number' ? String(c.damage) : c.damage === '4x bet' ? '×4' : String(c.damage ?? '');
    out += numeral(dmg, W - 58, H - 58, dmg.length > 3 ? 72 : 92, 'end');
  }
  return out;
}

function classCard(c) {
  let out = frame('#fff', '#111', false);
  out += oval(FACE.violet, false);
  out += glyphAt(c.icon, 315 - 150, 430 - 150, 300, { stroke: FACE.violet });
  return out;
}

function advantageCard(c) {
  let out = frame('#fff', '#111', false);
  out += oval(FACE.gold, false);
  out += glyphAt(c.icon, 315 - 150, 430 - 150, 300, { stroke: '#111' });
  // a small gold chip top-left marks the deck without a word
  out += `<circle cx="92" cy="92" r="30" fill="${FACE.gold}" stroke="#111" stroke-width="6"/>`;
  return out;
}

const BIOME_RULE_MARK = { forest: ['eye', '0'], village: ['life', '+1'], castle: ['crown', '×2'] };
function biomeCard(c) {
  const colour = c.element ? FACE[c.element] : FACE.brown;
  let out = frame('#fff', '#111', false);
  if (c.element) out += sigilBadge(c.element, 102, 102);
  out += oval(colour, false);
  out += glyphAt(c.icon, 315 - 150, 430 - 150, 300, { stroke: colour });
  const mark = BIOME_RULE_MARK[c.id];
  if (mark) {
    out += glyphAt(mark[0], W - 200, H - 130, 80, { stroke: '#111' });
    out += numeral(mark[1], W - 58, H - 58, 80, 'end');
  }
  return out;
}

function bossCard(c) {
  let out = frame('#fff', '#111', false);
  // top-left: life cards x value (the two numbers the rulebook says the card states)
  out += numeral(`${c.life_cards}×${c.per_card}`, 52, 112, 80);
  out += oval('#111', false);
  out += glyphAt(c.icon, 315 - 150, 430 - 170, 300, { stroke: '#111' });
  out += numeral(c.size, 315, 648, 110, 'middle');
  // bottom-left: rage round in a red chip (a minion has none)
  if (c.rage) {
    out += `<circle cx="112" cy="${H - 92}" r="56" fill="${FACE.red}"/>`;
    out += numeral(String(c.rage), 112, H - 68, 72, 'middle', '#fff');
  }
  // bottom-right: damage
  out += numeral(String(c.damage), W - 58, H - 58, 92, 'end');
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

// Player aids are reference cards, the one place a label is allowed. The dice
// ladder is generated from the same targets the engine uses (game/rules.js
// ports tools/dice_bridge.py); the view passes them in via opts.aid.
function aidCard(c, opts) {
  let out = frame('#fff', '#111', false);
  if (c.id === 'aid-checks' && opts.aid?.ladder) {
    // One row per die, one column per step (pips as the header), so "16+"
    // has a 110-unit column instead of the 52 it got with dice as columns.
    const { dice, rows } = opts.aid.ladder; // dice: ['d20',...]; rows: [{step, pips, odds, targets}]
    const x0 = 150, colW = (W - 40 - x0) / rows.length, y0 = 150, rowH = (H - 60 - y0) / dice.length;
    rows.forEach((r, j) => {
      const cx = x0 + colW * j + colW / 2;
      out += pipRow(r.pips, cx - (r.pips * 30 - 8) / 2, 78, { r: 11, gap: 30 });
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
  let out = frame(FACE.extra, FACE.gold, true);
  out += glyphAt(c.icon, 315 - 150, 380 - 150, 300, { stroke: FACE.gold, width: 2.6 });
  // the comeback ladder: free, then one, two, three, four pips
  const y = 690, gap = 108, x0 = 315 - gap * 2;
  out += `<circle cx="${x0}" cy="${y}" r="20" fill="none" stroke="${FACE.gold}" stroke-width="7"/>`;
  for (let i = 1; i <= 4; i++) {
    out += pipRow(i, x0 + gap * i - (i * 26 - 8) / 2, y, { r: 9, gap: 26 });
  }
  out += `<line x1="${x0 - 34}" y1="${y + 48}" x2="${x0 + gap * 4 + 44}" y2="${y + 48}" stroke="${FACE.gold}" stroke-width="4" opacity="0.5"/>`;
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

/** A card back: the deck's face colour, a gold ring, nothing else. */
const BACK_DARK = { fire: '#7f1d1d', water: '#1e3a8a', earth: '#14532d', wind: '#334155', extra: '#713f12', boss: '#000000', skill: '#713f12' };

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
 * Both are a solid field, which is deliberate but not free: 92 of these is real
 * ink on a home printer. `light` swaps to a paper field with a coloured border
 * for anyone who would rather keep their cartridge.
 */
export function cardBack(kind = 'skill', { light = false } = {}) {
  // The Extra life card is white-faced, and a white back on white paper is a
  // blank card: it gets the brown instead.
  const colour = kind === 'extra' ? FACE.brown : FACE[kind] || FACE.gold;
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
    out += `<circle cx="315" cy="440" r="120" fill="none" stroke="${ink}" stroke-width="16" opacity="0.85"/>`;
    out += `<circle cx="315" cy="440" r="66" fill="none" stroke="${ink}" stroke-width="10" opacity="0.6"/>`;
  }
  return `<svg class="sk-card sk-card--sheet" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="card back">${out}</svg>`;
}

/** Life-card face for the runner's piles: a tiny coloured card with the sigil. */
export function lifeMini(kind, stateCls = '') {
  const fill = kind === 'boss' ? FACE.boss : kind === 'extra' ? FACE.extra : FACE[kind] || '#fff';
  const sig = ELEMENT_SIGIL[kind];
  let inner = '';
  if (sig) inner = glyphAt(sig, 315 - 140, 440 - 140, 280, { stroke: '#fff', width: 2.8 });
  else if (kind === 'boss') inner = glyphAt('crown', 315 - 140, 440 - 140, 280, { stroke: FACE.gold, width: 2.4 });
  else inner = numeral('25', 315, 520, 260, 'middle', '#111');
  return `<svg class="sk-card sk-card--mini lc ${stateCls}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `<rect x="15" y="15" width="${W - 30}" height="${H - 30}" rx="50" fill="${fill}" stroke="#111" stroke-width="16"/>${inner}</svg>`;
}
