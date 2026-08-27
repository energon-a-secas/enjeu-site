// ── Placeholder figures ──────────────────────────────────────
// Heroes and bosses as brick-built silhouettes: stud-topped rectangles in
// flat colour, a round head, nothing that names a brand. Drawn in a 120 x
// 120 box; the boss size scales the stack. These are explicitly stand-ins
// (data/placeholders.js marks every one) for the art pass that comes later.

import { glyphPath, GLYPH_SIZE } from '../cards/glyphs.js';

const COLOUR = { fire: '#dc2626', water: '#2563eb', earth: '#16a34a', wind: '#64748b', boss: '#111111', gold: '#eab308', none: '#111111' };
const dark = (hex) => hex === '#111111' ? '#000' : hex;

/** A brick: a rounded rect with studs along its top edge. */
function brick(x, y, w, h, fill, studs = Math.max(1, Math.round(w / 12))) {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="${dark(fill)}" stroke-width="1.5"/>`;
  const gap = w / studs;
  for (let i = 0; i < studs; i++) {
    const cx = x + gap * (i + 0.5);
    out += `<rect x="${cx - 3}" y="${y - 3}" width="6" height="3.5" rx="1" fill="${fill}" stroke="${dark(fill)}" stroke-width="1"/>`;
  }
  return out;
}
const head = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${dark(fill)}" stroke-width="1.5"/>`
  + `<circle cx="${cx - r * 0.35}" cy="${cy - r * 0.15}" r="${r * 0.13}" fill="#fff"/><circle cx="${cx + r * 0.35}" cy="${cy - r * 0.15}" r="${r * 0.13}" fill="#fff"/>`;
const eyes = (cx, cy, d, r = 2.2) => `<circle cx="${cx - d}" cy="${cy}" r="${r}" fill="#fff"/><circle cx="${cx + d}" cy="${cy}" r="${r}" fill="#fff"/>`;

function glyphBadge(id, cx, cy, r, colour) {
  const d = glyphPath(id);
  if (!d) return '';
  const k = (r * 1.3) / GLYPH_SIZE;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${colour}" stroke-width="2"/>`
    + `<g transform="translate(${cx - r * 0.65} ${cy - r * 0.65}) scale(${k})"><path d="${d}" fill="none" stroke="${colour}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

// ── Silhouettes ──────────────────────────────────────────────
function minifig(c, klass) {
  let out = brick(42, 84, 14, 26, c, 1) + brick(64, 84, 14, 26, c, 1);   // legs
  out += brick(38, 50, 44, 34, c, 3);                                      // torso
  out += brick(26, 52, 12, 24, c, 1) + brick(82, 52, 12, 24, c, 1);        // arms
  out += head(60, 34, 14, c);
  out += `<rect x="50" y="16" width="20" height="6" rx="2" fill="${c}" stroke="${dark(c)}" stroke-width="1.5"/>`; // stud on top
  if (klass) out += glyphBadge(klass, 96, 30, 14, c);
  return out;
}
function minion(c) {
  return brick(48, 76, 10, 18, c, 1) + brick(62, 76, 10, 18, c, 1) + brick(44, 50, 32, 26, c, 2) + head(60, 38, 10, c);
}
function beetle(c) {
  let out = '';
  for (const [x, y] of [[18, 96], [34, 100], [50, 102], [70, 102], [86, 100], [102, 96]]) out += `<line x1="${x}" y1="${y}" x2="${x < 60 ? x + 10 : x - 10}" y2="80" stroke="${dark(c)}" stroke-width="4" stroke-linecap="round"/>`;
  out += brick(24, 56, 72, 30, c, 5) + brick(34, 36, 52, 20, c, 4);
  out += head(60, 30, 12, c);
  out += `<path d="M52 20 L44 6 M68 20 L76 6" stroke="${dark(c)}" stroke-width="3" stroke-linecap="round"/>`;
  return out;
}
function serpent(c) {
  let out = brick(10, 96, 28, 16, c, 2) + brick(36, 82, 28, 16, c, 2) + brick(20, 66, 28, 16, c, 2) + brick(44, 50, 28, 16, c, 2) + brick(68, 34, 28, 16, c, 2);
  out += head(100, 26, 12, c);
  out += `<path d="M110 26 L118 22 M110 26 L118 30" stroke="${dark(c)}" stroke-width="2.5" stroke-linecap="round"/>`;
  return out;
}
function golem(c) {
  let out = brick(30, 90, 22, 22, c, 2) + brick(68, 90, 22, 22, c, 2);
  out += brick(26, 44, 68, 46, c, 5);
  out += brick(8, 46, 18, 40, c, 1) + brick(94, 46, 18, 40, c, 1);
  out += brick(40, 18, 40, 26, c, 3) + eyes(60, 30, 9, 3);
  return out;
}
function wyrm(c) {
  let out = `<path d="M14 70 L4 30 L40 56 Z M106 70 L116 30 L80 56 Z" fill="${c}" stroke="${dark(c)}" stroke-width="1.5"/>`;
  out += brick(34, 56, 52, 26, c, 4) + brick(44, 82, 32, 18, c, 3) + brick(48, 100, 24, 12, c, 2);
  out += head(60, 40, 14, c);
  out += `<path d="M48 30 L40 14 M72 30 L80 14" stroke="${dark(c)}" stroke-width="3" stroke-linecap="round"/>`;
  return out;
}
function king(c) {
  let out = brick(22, 94, 26, 20, c, 2) + brick(72, 94, 26, 20, c, 2);
  out += brick(14, 44, 92, 50, c, 7);
  out += brick(2, 48, 14, 36, c, 1) + brick(104, 48, 14, 36, c, 1);
  out += brick(36, 18, 48, 26, c, 4) + eyes(60, 30, 11, 3.2);
  out += `<path d="M36 18 L36 4 L48 12 L60 2 L72 12 L84 4 L84 18 Z" fill="${COLOUR.gold}" stroke="#a16207" stroke-width="1.5"/>`;
  return out;
}
const SHAPES = { minifig, minion, beetle, serpent, golem, wyrm, king };
const SCALE = { S: 0.6, M: 0.8, L: 0.9, XL: 1, UM: 1.08 };

/**
 * @param {{silhouette:string, element?:string|null, size?:string, klass?:string|null}} fig
 * @param {{cls?: string, hit?: boolean}} opts
 */
export function figureSvg(fig, opts = {}) {
  const c = COLOUR[fig.element || 'none'] || COLOUR.none;
  const draw = SHAPES[fig.silhouette] || minifig;
  const k = fig.size ? (SCALE[fig.size] || 1) : 1;
  const body = draw(c, fig.klass);
  const t = k === 1 ? '' : ` transform="translate(${60 - 60 * k} ${120 - 120 * k}) scale(${k})"`;
  return `<svg class="fig ${opts.cls || ''}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${fig.name || fig.silhouette}"><g${t}>${body}</g></svg>`;
}
