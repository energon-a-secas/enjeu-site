// ── Print sheet (contract C7) ────────────────────────────────
// Fills #printSheet with one .print-cell per physical card (copies expanded),
// 9 per A4 page; print.css does the paging. Nothing here is visible on
// screen. The caller decides which cards and whether to add backs.

import { cardFace, cardBack } from './face.js';

/**
 * Which back belongs to a card. Backs are not interchangeable: a life card's
 * back carries its own element colour and the break that means Broken, while
 * every other card gets the unbroken pool back.
 *
 * Exported because the browse grid shows backs on screen too, and a screen that
 * previews a back the printer will not produce is worse than one that shows no
 * back at all. One mapping, imported twice, so the two cannot drift.
 */
const FACE_KIND = { red: 'fire', blue: 'water', green: 'earth', grey: 'wind', white: 'extra', black: 'boss' };
export const backKind = (c) => (c.deck === 'life' ? (c.element || FACE_KIND[c.face] || 'extra') : 'skill');

/**
 * @param {object[]} physical  cards with copies already expanded (data/cards.js)
 * @param {{backs?: boolean, aid?: object, paper?: 'a4'|'letter'}} opts
 * @returns {number} pages filled
 */
export function renderPrintSheet(physical, opts = {}) {
  const host = document.getElementById('printSheet');
  if (!host) return 0;
  // A selector-scoped @page (html.sk-letter @page {...}) is invalid CSS and was
  // silently dropped, so the Letter toggle printed A4. The size is set here: a
  // later @page overrides print.css's A4 base. Letter portrait is 279.4mm tall;
  // 3 rows of 88mm + two 2mm gutters need 268mm, so Letter gets 5mm margins.
  let pageStyle = document.getElementById('pageSizeStyle');
  if (!pageStyle) { pageStyle = document.createElement('style'); pageStyle.id = 'pageSizeStyle'; document.head.appendChild(pageStyle); }
  pageStyle.textContent = opts.paper === 'letter' ? '@page { size: Letter portrait; margin: 5mm; }' : '';
  const cells = physical.map((c) => `<div class="print-cell">${cardFace(c, { size: 'sheet', aid: opts.aid })}</div>`);
  // 'all' mirrors the run card for card so each front has its matching back;
  // 'few' prints one per element, which is what a single fight actually turns
  // face down. Which back a card takes is backKind, above.
  if (opts.backs === 'all') {
    for (const c of physical) cells.push(`<div class="print-cell">${cardBack(backKind(c), { light: opts.lightInk })}</div>`);
  } else if (opts.backs === 'few') {
    for (const k of ['fire', 'water', 'earth', 'wind']) {
      cells.push(`<div class="print-cell">${cardBack(k, { light: opts.lightInk })}</div>`);
    }
  }
  host.innerHTML = cells.join('');
  return Math.ceil(cells.length / 9);
}

export function clearPrintSheet() {
  const host = document.getElementById('printSheet');
  if (host) host.innerHTML = '';
}
