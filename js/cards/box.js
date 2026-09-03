// ── The box the deck ships in ────────────────────────────────
// Six panels for a print-on-demand tuck box, drawn from the same parts as the
// cards: the site's mark, the in-house glyph set, the element colours, and the
// card frame's own proportions. Nothing new is invented here, which is the
// point: the box is the first thing anyone sees and it should look like what is
// inside it.
//
// Dimensions are MILLIMETRES and everything else is derived, because the box is
// sized by the deck rather than by a design: 111 cards at about 0.32mm each is
// a 35.5mm stack, so the spine is 38mm and the panels follow. Change BOX and
// every panel re-lays itself.
//
// Colour scheme, and the reason for the split: the wide panels are the cards'
// own cream, because that is what the buyer finds when they open it, and the
// spines and lids are the site's dark chrome, because a spine is what you see
// on a shelf and cream disappears there.

import { FACE } from './face.js';
import { glyphPath } from './glyphs.js';
import { figureSvg } from '../game/figures.js';

export const BOX = { w: 65, h: 90, d: 38 };   // internal, in mm, for 111 cards
export const MM = 10;                          // user units per mm, as the cards use

const INK = '#141210';
const PAPER = '#fffdf7';
const GOLD = FACE.gold;
const DEEP = '#a16207';
const ELEMENTS = ['fire', 'water', 'earth', 'wind'];

/** Every panel this box has, and the millimetre size of each. */
export const PANELS = {
  front: { w: BOX.w, h: BOX.h, label: 'Frente' },
  back: { w: BOX.w, h: BOX.h, label: 'Dorso' },
  spine: { w: BOX.d, h: BOX.h, label: 'Lomo' },
  lid: { w: BOX.w, h: BOX.d, label: 'Tapa' },
};

export function panelSize(name, dpi = 300) {
  const p = PANELS[name];
  const k = dpi / 25.4;
  return { widthMm: p.w, heightMm: p.h, width: Math.round(p.w * k), height: Math.round(p.h * k), dpi };
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const text = (t, x, y, size, { fill = INK, anchor = 'middle', weight = 800, spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}"`
  + `${spacing ? ` letter-spacing="${spacing}"` : ''} font-family="${FONT}">${esc(t)}</text>`;

/**
 * The site's mark: a life card standing and one turned sideways, which is the
 * game's one rule drawn in two rectangles. Taken from logo.svg rather than
 * redrawn, so the box, the tab icon and the header cannot drift apart.
 */
function mark(x, y, size, colour) {
  const k = size / 68;
  return `<g transform="translate(${x} ${y}) scale(${k})" fill="none" stroke="${colour}"
    stroke-width="4.019" stroke-linecap="round" stroke-linejoin="round">
    <rect x="10" y="12" width="22" height="32" rx="4"/>
    <circle cx="21" cy="28" r="4" fill="${colour}" stroke="none"/>
    <rect x="30" y="30" width="28" height="20" rx="4"/>
    <circle cx="44" cy="40" r="3" fill="${colour}" stroke="none"/>
    <path d="M38 12l4 6 6-2"/></g>`;
}

/**
 * A figure from the game, placed and scaled. `element: null` renders it in the
 * boss black (js/game/figures.js COLOUR.none), which is what a box front wants:
 * one solid silhouette that still reads across a room. Nested rather than
 * redrawn, so the character on the box is the same brick figure the board plays.
 */
function figure(silhouette, x, y, size) {
  const svg = figureSvg({ silhouette, element: null, name: silhouette });
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
  const k = size / 120;
  return `<g transform="translate(${x} ${y}) scale(${k})">${inner}</g>`;
}

/** One glyph from the deck's own set, placed and scaled. */
function icon(id, x, y, size, colour, width = 2.4) {
  const d = glyphPath(id);
  if (!d) return '';
  const k = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${k})" fill="none" stroke="${colour}"
    stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;
}

/** The four element sigils in a row, in their own colours. */
function elementRow(cx, y, size, gap) {
  const total = ELEMENTS.length * size + (ELEMENTS.length - 1) * gap;
  return ELEMENTS.map((el, i) =>
    icon(el, cx - total / 2 + i * (size + gap), y, size, FACE[el], 2.6)).join('');
}

/** A panel's shell: opaque field, and a hairline keyline inset for the trim. */
function shell(w, h, field, rule) {
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${field}"/>`
    + `<rect x="${MM * 4}" y="${MM * 4}" width="${w - MM * 8}" height="${h - MM * 8}" rx="${MM * 2}"
        fill="none" stroke="${rule}" stroke-width="3" opacity="0.55"/>`;
}

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

// ── The six panels ───────────────────────────────────────────

/**
 * Front: the name, the one rule as a picture, and the three numbers a buyer
 * decides on. No sentence longer than a breath, because a box front is read
 * from a metre away.
 */
export function frontPanel(t) {
  const w = BOX.w * MM, h = BOX.h * MM;
  let o = shell(w, h, PAPER, DEEP);

  // Laid out as a stack with real gaps rather than magic fractions of the
  // panel. The first attempt placed the figure and the wordmark at 0.075h and
  // 0.46h and they collided: the character's legs ran straight through NJE. A
  // text baseline sits about 0.72 of its own size below its cap, so each block
  // is placed from the bottom of the one above it plus a stated gap, and the
  // two cannot overlap however the box is resized.
  const cap = (size) => size * 0.72;
  const figSize = h * 0.31;
  const figTop = h * 0.075;
  let y = figTop + figSize;                        // bottom of the character

  o += figure('minifig', w / 2 - figSize / 2, figTop, figSize);

  const nameSize = h * 0.105;
  y += h * 0.035 + cap(nameSize);
  o += text('ENJEU', w / 2, y, nameSize, { spacing: nameSize * 0.15 });

  const tagSize = h * 0.029;
  y += h * 0.030 + cap(tagSize);
  o += text(t.tagline, w / 2, y, tagSize, { fill: '#6b6455', weight: 600 });

  const sigil = h * 0.068;
  y += h * 0.028;
  o += elementRow(w / 2, y, sigil, sigil * 0.62);
  y += sigil;

  // The three facts that decide a purchase, as numerals with a word under each.
  const numSize = h * 0.080, labelSize = h * 0.024;
  const numY = y + h * 0.085 + cap(numSize);
  [['1', t.players], ['1', t.dieWord], ['15', t.minutes]].forEach(([n, label], i) => {
    const x = w * (0.22 + i * 0.28);
    o += text(n, x, numY, numSize, { fill: DEEP });
    o += text(label, x, numY + h * 0.012 + cap(labelSize), labelSize, { fill: '#6b6455', weight: 600 });
  });

  o += text(t.cards, w / 2, h * 0.925, h * 0.029, { fill: '#6b6455', weight: 700, spacing: 3 });
  return svg(w, h, o);
}

/** Back: what is in the box, and what you supply yourself. */
export function backPanel(t) {
  const w = BOX.w * MM, h = BOX.h * MM;
  let o = shell(w, h, PAPER, DEEP);
  o += text(t.whatIsIt, w / 2, h * 0.125, 24, { fill: '#6b6455', weight: 600 });
  o += text('ENJEU', w / 2, h * 0.20, 60, { spacing: 10 });
  // The pitch, one line per line: a box back that wraps is a box back nobody reads.
  t.pitch.forEach((line, i) => {
    o += text(line, w / 2, h * (0.29 + i * 0.042), 23, { fill: INK, weight: 500 });
  });
  o += `<line x1="${w * 0.18}" y1="${h * 0.49}" x2="${w * 0.82}" y2="${h * 0.49}" stroke="${DEEP}" stroke-width="2" opacity="0.5"/>`;
  // What is inside, as a list with the deck's own icons beside each row.
  t.contents.forEach(([id, line], i) => {
    const y = h * (0.56 + i * 0.062);
    o += icon(id, w * 0.17, y - 24, 44, DEEP, 2.6);
    o += text(line, w * 0.28, y + 10, 24, { anchor: 'start', weight: 600 });
  });
  o += text(t.supply, w / 2, h * 0.87, 23, { fill: '#6b6455', weight: 600 });
  o += text(t.site, w / 2, h * 0.925, 24, { fill: DEEP, weight: 700, spacing: 2 });
  return svg(w, h, o);
}

/**
 * Spine: the one panel that has to work at a glance on a shelf, so it is dark
 * with the wordmark running up it and nothing else competing.
 */
export function spinePanel(t) {
  const w = BOX.d * MM, h = BOX.h * MM;
  let o = `<rect x="0" y="0" width="${w}" height="${h}" fill="${INK}"/>`;
  o += mark(w / 2 - 78, h * 0.05, 156, GOLD);
  // Rotated about the panel's own centre so it reads bottom to top, the way a
  // spine is read when the box stands on a shelf.
  // Sized to the panel, not to a guess: five letters plus their tracking should
  // fill about three fifths of a 90mm spine, or the name floats in the middle of
  // a lot of black and the box reads as unfinished on a shelf.
  const spineType = Math.round((h * 0.60) / (5 * 0.62 + 4 * 0.34));
  o += `<g transform="rotate(-90 ${w / 2} ${h / 2})">`
    + text('ENJEU', w / 2, h / 2 + spineType * 0.34, spineType, { fill: PAPER, spacing: spineType * 0.34 })
    + `</g>`;
  o += elementRow(w / 2, h * 0.88, 44, 18);
  return svg(w, h, o);
}

/** Lid: the mark, the name, and the count. Small panels say one thing. */
export function lidPanel(t) {
  const w = BOX.w * MM, h = BOX.d * MM;
  let o = `<rect x="0" y="0" width="${w}" height="${h}" fill="${INK}"/>`;
  o += mark(w * 0.09, h / 2 - 66, 132, GOLD);
  o += text('ENJEU', w * 0.40, h / 2 + 2, 58, { anchor: 'start', fill: PAPER, spacing: 12 });
  o += text(t.cards, w * 0.40, h / 2 + 40, 22, { anchor: 'start', fill: GOLD, weight: 700, spacing: 2 });
  return svg(w, h, o);
}

/** Every panel the service asks for, keyed by the name it uses. */
export function boxPanels(t) {
  return { front: frontPanel(t), back: backPanel(t), spine: spinePanel(t), lid: lidPanel(t) };
}

/** The words, kept here so the box is bilingual like everything else. */
export const BOX_COPY = {
  es: {
    tagline: 'Equilibra tu ataque y tu defensa',
    players: 'jugador', dieWord: 'dado', minutes: 'min por nivel',
    cards: '111 CARTAS',
    whatIsIt: 'Un juego de cartas para imprimir y jugar',
    pitch: [
      'Peleas contra un jefe que armas con tus bloques.',
      'Apuestas cartas de vida para pegar más fuerte,',
      'y las guardas para defenderte cuando el jefe pega.',
      'Una sola regla, y todo sale de ahí.',
    ],
    contents: [
      ['strike', '6 cartas de Ataque'],
      ['skill-slash', '26 de Habilidad, 4 de Clase'],
      ['adv-cure', '12 de Ventaja, 7 de Bioma'],
      ['boss-m', '6 de Jefe, 41 de Vida, 5 de Ayuda'],
    ],
    supply: 'Tú pones un dado y tus bloques.',
    site: 'enjeu.neorgon.com',
  },
  en: {
    tagline: 'Balance your attack and your defense',
    players: 'player', dieWord: 'die', minutes: 'min a level',
    cards: '111 CARDS',
    whatIsIt: 'A print and play boss rush card game',
    pitch: [
      'You fight a boss you build out of your own bricks.',
      'You bet life cards to hit harder,',
      'and you keep them back to guard when it swings.',
      'One rule, and everything comes from it.',
    ],
    contents: [
      ['strike', '6 Attack cards'],
      ['skill-slash', '26 Skill, 4 Class'],
      ['adv-cure', '12 Advantage, 7 Biome'],
      ['boss-m', '6 Boss, 41 Life, 5 Player aid'],
    ],
    supply: 'You supply one die and your bricks.',
    site: 'enjeu.neorgon.com',
  },
};
